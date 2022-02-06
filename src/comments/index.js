const cors = require('cors')
const express = require("express")
const { MongoClient, ObjectId } = require('mongodb')
const { createClient } = require('redis')
const axios = require("axios").default

const app = express()
app.use(cors())
app.use(express.json())
const port = process.env.port || 5000
const commentsCollectionName = `comments`

const connectToDatabase = async () =>  {
    try {
        const dbConnectionString = process.env.DBCONNECTIONSTRING
        const dbName = process.env.DBNAME
        if (!dbConnectionString || !dbName)
            throw new Error("Environment variable for db connection string or db name not defined.")
        
        const url = `mongodb://${dbConnectionString}/${dbName}`
        const client = new MongoClient(url)
        await client.connect()
        console.log('connected to database!')
        return client.db(dbName)
    }
    catch(error) {
        console.error(error.message)
        return undefined
    }
}

const connectToRedis = async () => {
    try {
        const redisServerName = process.env.CACHENAME
        const redisServerPort = process.env.CACHEPORT ? parseInt(process.env.CACHEPORT) :  6379
        const client = createClient({
            url: `redis://${redisServerName}:${redisServerPort}`
        })
        client.connect()
        console.log('connected to cache!')
        return client
    }
    catch (error) {
        console.error(error)
        return undefined
    }
}

const runServer = async () => {
    try {
        const connection = await connectToDatabase()
        if (!connection) {
            throw new Error("Unable to connect to database.")
        }

        const redis = await connectToRedis()
        if (!redis) {
            throw new Error("Unable to connect to redis.")
        }
        
        app.post('/', async (req, res) => {
            const payload = req.body
            const { postId, message } = payload
            try {
                if (postId == null || message == null) {
                    throw new Error("Incorrect payload")
                }
                const postServiceName = process.env.POSTS
                if (!postServiceName) {
                    return res.status(400).json({"msg": "Environment variable for posts service name not set!"})
                }
                const fetchPostRequest = await axios.get(`http://${postServiceName}:${port}/${postId}`)
                const post = await fetchPostRequest.data
                if (!post) {
                    return res.status(400).json({"msg": `Post with ID #${postId} not found!`})
                }
                
                const collection = connection.collection(commentsCollectionName)
                const comment = await collection.insertOne(payload)
                let cachedComments = await redis.get(postId)
                if (!cachedComments) {
                    console.log(`Inserting a new record for comments with post with ID #${postId} into the cache`)
                    await redis.set(postId, JSON.stringify([{...payload, _id: comment.insertedId}]))
                } else {
                    cachedComments = JSON.parse(cachedComments)
                    cachedComments.push({...payload, _id: comment.insertedId})
                    await redis.set(postId, JSON.stringify(cachedComments))
                    console.log(`updating the cache, setting comments for post with ID #${postId}`)
                }
                return res.status(201).json(comment)
            }
            catch (error) {
                console.error(error)
                return res.status(500).json({error: error.message})
            }
        })
        
        app.get('/:id', async (req, res) => {
            try {
                const postId = req.params['id']
                console.log(`Incoming request to return comments associated with post ID #${postId}`)

                let cachedComments = await redis.get(postId)
                if (!cachedComments || (cachedComments && cachedComments.length === 0)) {
                    console.log('cache miss')
                    const collection = connection.collection(commentsCollectionName)
                    cachedComments = await collection.find({postId: postId}).toArray()
                    await redis.set(postId, JSON.stringify(cachedComments))
                    console.log(`comments for post with ID #${postId} successfully written to cache.`)
                } else {
                    console.log('Returning from cache.')
                    cachedComments = JSON.parse(cachedComments)
                }

                return res.status(200).json(cachedComments)
            }
            catch(error) {
                console.error(error)
                return res.status(500).json({"error": error.message})
            }
        })
    
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server listening on port ${port}`)
        })
    
    }
    catch (error) {
        console.error(error.message)
    }
}

runServer()
