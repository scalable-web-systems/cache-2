# Tutorial on Caching 2 | Redis
> **Author -** Ishaan Khurana, [LinkedIn](https://www.linkedin.com/in/ishaan-khurana-46968679/)

## Objective
This tutorial is the second tutorial in the **caching** series. Click [here](https://github.com/scalable-web-systems/cache-1) to go to the first tutorial in this series. In this tutorial, we'll learn how to integrate Redis, an off the shelf caching server, into our docker-compose script and how to use the corresponding npm package in our node applications.

## Prerequisites
##### Side note: There are links attached to the bottom of this tutorial for our readers who may not be familiar with the technologies used here.
1. The reader should have completed the [first](https://github.com/scalable-web-systems/docker-compose-node), [second](https://github.com/scalable-web-systems/docker-compose-gateway) and [third](https://github.com/scalable-web-systems/docker-compose-mongo) tutorials of the **docker-compose** series. 
2. The reader should have completed the [first](https://github.com/scalable-web-systems/cache-1) tutorial of this series.
3. The reader should be familiar with axios, asynchrous operations, promises, etc.
4. The reader should have PostMan installed on their machine. Alternatively, one can use CLI tools such as Curl, WGet etc. to make the API calls.
5. The reader should clone this repository to their local machine before moving on to the next section.

## Code

> docker-compose.yml

Even though one is required to complete the [first](https://github.com/scalable-web-systems/cache-1) tutorial of this series in order to have a strong grasp on caching fundamentals and be able to follow along this tutorial, the `docker-compose.yml` script used in this tutorial doesn't build on the one used in the previous tutorial of the series. Instead, the docker-compose script used here builds on the one used in the [third]() tutorial of the **docker-compose** series.

```
version: '3.3'
services:
  posts:
    build:
      context: ./src/posts
    expose:
      - 5000
    environment:
      - COMMENTS=comments
      - DBCONNECTIONSTRING=mongo
      - DBNAME=db
      - CACHENAME=postscache
    depends_on:
      - mongo
      - postscache
    networks:
      - network
  
  comments:
    build:
      context: ./src/comments
    expose:
      - 5000
    environment:
      - POSTS=posts
      - DBCONNECTIONSTRING=mongo
      - DBNAME=db
      - CACHENAME=commentscache
    depends_on:
      - mongo
      - commentscache
    networks:
      - network
  
  reverseproxy:
    build: 
      context: ./src/reverseproxy
    ports:
      - 5000:5000
    environment:
      - POSTS=posts
      - COMMENTS=comments
    depends_on:
      - posts
      - comments
    networks:
      - network

  mongo:
    image: mongo:latest
    environment:
      - MONGO_INITDB_DATABASE=db
    volumes:
      - ./data:/data/db
    expose:
      - 5000
    networks:
      - network
  
  postscache:
    image: redis:latest
    restart: always
    expose:
      - 6379
    command: redis-server --maxmemory-policy allkeys-lru
    networks:
      - network

  commentscache:
    image: redis:latest
    restart: always
    expose:
      - 6379
    command: redis-server --maxmemory-policy allkeys-lru
    networks:
      - network

networks:
  network:
```

So what's changed? We have introduced two new caching services - **postscache** and **commentscache**. They both use the **redis** image from DockerHub, just like our **mongo** database service. **Redis** is an open source in-memory data store used as a database, cache, and a message broker. In this tutorial, we'll be using redis as a cache. Both of the cache services are private and expose their port **6379**. They are both connected to our custom network **network**. They both execute the command `redis-server --maxmemory-policy allkeys-lru`. Let's see wha this command is doing. 

So this command instructs the redis server to use the LRU eviction policy. More specifically, `--maxmemory-policy allkeys-lru` instructs the server that when the memory is maxed out, remove the least recently used keys to accomodate the new ones.

Now let's see how our API services are interacting with these two redis servers.

> src/posts/index.js

We use the node package [**redis**](https://www.npmjs.com/package/redis) and import its member function **createClient**

```
const { createClient } = require('redis')
```
Next, we create a helper method that establishes connection to the server and returns the connection object or undefined otherwise

>lines 33-48

```
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
```

Just like the database connection, we attempt to connect to the redis server by invoking the aforementioned function. If undefined is returned, we throw an exception and the server won't fire up.

> lines 58-61

```
const redis = await connectToRedis()
if (!redis) {
    throw new Error("Unable to connect to redis.")
}
```

In an attempt to not dilute this tutorial with extraneous, tangential details, let's just say that there are only limited number of data structures that redis supports and the data structures used in this tutorial are complex enough that we will stick to string data type for storing and retrieiving data from the redis cache. We have used **JSON.stringify** and **JSON.parse** methods to convert our data from one form to the other and the **get** and **set** method available on the connection object returned by **connectToRedis** helper method and stored in **redis** variable for reading from and writing to the redis cache.

For example,

> lines 98 - 111

```
let post = await redis.get(_id)
if (!post) {
    console.log('cache miss!')
    const collection = connection.collection(postsCollection)
    post = await collection
        .findOne({_id: oid})
    console.log('writing to the cache')
    await redis.set(_id, JSON.stringify(post))
    console.log(`Post with ID #${_id} successfully written to the database`)
}
else {
    post = JSON.parse(post)
    console.log(`returning from the cache, the post with ID #${post._id}`)
}
```

**Note:** The comments service is coded in a very similar way and if the reader has completed all other tutorials, they shouldn't have a hard time following along the code included in this repository.

## Steps
Follow the steps laid out in the [first](https://github.com/scalable-web-systems/cache-1) tutorial of this series. Log output is very similar and can be inspected using the command `docker-compose logs <service_name>`.

## Conclusion
After doing this tutorial, one should be to use Redis as a docker-compose service. Additionally, one should be able to use the npm **redis** package in their node applications to communicate with the Redis server and successfully use it for caching. 

### Links
1. [Javascript Tutorial](https://www.w3schools.com/js/)
2. [Npm](https://www.npmjs.com/)
3. [NodeJS](https://nodejs.org/en/docs/)
4. [Express](https://expressjs.com/en/starter/hello-world.html)
5. [Docker](https://docs.docker.com/get-started/)
6. [Fast Gateway NPM Package](https://www.npmjs.com/package/fast-gateway)
7. [Promises, Async, Await - JS](https://javascript.info/async)
8. [Axios](https://github.com/axios/axios)
9. [MongoDB NPM package](https://www.npmjs.com/package/mongodb)
10. [Redis Node NPM package](https://www.npmjs.com/package/redis)


