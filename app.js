const {open} = require('sqlite')
const express = require('express')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
let dbpath = path.join(__dirname, 'twitterClone.db')

let db = null

let serverinstaliser = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error : ${e.message}`)
    process.exit(1)
  }
}
serverinstaliser()

//post method

app.post('/register/', async (request, response) => {
  const moviedetails = request.body
  const {username, password, name, gender} = moviedetails
  const checkquery = `SELECT * FROM user WHERE username='${username}'`
  const check = await db.get(checkquery)
  if (check === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const uniqpass = await bcrypt.hash(password, 2)
      const detailquery = `INSERT INTO USER(name,username,password,gender) 
      VALUES('${name}','${username}','${uniqpass}','${gender}')`
      await db.run(detailquery)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})
// login

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}
//get method
const convertDbObjectToResponseObject2 = dbobject => {
  return dbobject.following_user_id
}
const convertDbObjectToResponseObject3 = dbobject => {
  return dbobject.follower_user_id
}
const convertDbObjectToResponseObject = dbobject => {
  return {
    username: dbobject.username,
    tweet: dbobject.tweet,
    dateTime: dbobject.date_time,
  }
}
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  let {username} = request
  const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
  const getuserid = await db.get(getuserquery)
  const getQuery = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getuserid.user_id}`
  const following_id = await db.all(getQuery)
  let detailid = following_id.map(id => convertDbObjectToResponseObject2(id))
  const tweet = `SELECT * FROM tweet LEFT JOIN user ON tweet.user_id=user.user_id
    WHERE tweet.user_id IN (${detailid})
    ORDER BY tweet.tweet_id DESC;`
  const tweetresponse = await db.all(tweet)
  response.send(
    tweetresponse.map(each => convertDbObjectToResponseObject(each)),
  )
})

//get following
const convertDbObjectToResponseObject1 = dbobject => {
  return {
    name: dbobject.name,
  }
}
app.get('/user/following/', authenticateToken, async (request, response) => {
  let {username} = request
  const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
  const getuserid = await db.get(getuserquery)
  const getQuery = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getuserid.user_id}`
  const following_id = await db.all(getQuery)
  let detailid = following_id.map(id => convertDbObjectToResponseObject2(id))
  const tweet = `SELECT * FROM user
    WHERE user_id IN (${detailid});`
  const tweetresponse = await db.all(tweet)
  response.send(
    tweetresponse.map(each => convertDbObjectToResponseObject1(each)),
  )
})
//get follower
app.get('/user/followers/', authenticateToken, async (request, response) => {
  let {username} = request
  const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
  const getuserid = await db.get(getuserquery)
  const getQuery = `SELECT follower_user_id FROM follower 
  WHERE following_user_id=${getuserid.user_id}`
  const following_id = await db.all(getQuery)
  let detailid = following_id.map(id => convertDbObjectToResponseObject3(id))
  const tweet = `SELECT * FROM user
    WHERE user_id IN (${detailid});`
  const tweetresponse = await db.all(tweet)
  response.send(
    tweetresponse.map(each => convertDbObjectToResponseObject1(each)),
  )
})
//get tweet
const convertDbObjectToResponseObject5 = dbobject => {
  return {
    tweet: dbobject.tweet,
    likes: dbobject.likes,
    replies: dbobject.replys,
    dateTime: dbobject.date_time,
  }
}
app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  let {username} = request
  const {tweetId} = request.params
  const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
  const getuserid = await db.get(getuserquery)
  const getQuery = `SELECT following_user_id FROM follower 
  WHERE follower_user_id= ${getuserid.user_id}`
  const following_id = await db.all(getQuery)
  let detailid = following_id.map(id => convertDbObjectToResponseObject2(id))
  let user = `SELECT user_id FROM tweet WHERE tweet_id= '${tweetId}'`
  const userdb = await db.get(user)
  if (userdb === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    if (detailid.includes(userdb.user_id)) {
      const tweet = `SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replys,tweet.date_time
    FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id
    LEFT JOIN like ON reply.tweet_id=like.tweet_id
    WHERE tweet.tweet_id= ${tweetId}
    GROUP BY tweet.tweet_id;`
      const tweetresponse = await db.get(tweet)
      response.send(convertDbObjectToResponseObject5(tweetresponse))
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  }
})
// tweet likes
const convertDbObjectToResponseObject4 = dbobject => {
  return dbobject.username
}
app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    let {username} = request
    const {tweetId} = request.params
    const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
    const getuserid = await db.get(getuserquery)
    const getQuery = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getuserid.user_id}`
    const following_id = await db.all(getQuery)
    let detailid = following_id.map(id => convertDbObjectToResponseObject2(id))
    let user = `SELECT user_id FROM tweet WHERE tweet_id= ${tweetId}`
    const userdb = await db.get(user)
    if (detailid.includes(userdb.user_id)) {
      const tweet = `SELECT user.username
    FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id
    INNER JOIN user ON user.user_id = like.user_id
    WHERE tweet.tweet_id=${tweetId};`
      const tweetresponse = await db.all(tweet)
      let likes_username = tweetresponse.map(id =>
        convertDbObjectToResponseObject4(id),
      )
      response.send({likes: likes_username})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)
// reply
const convertDbObjectToResponseObject6 = dbobject => {
  return {
    name: dbobject.name,
    reply: dbobject.reply,
  }
}
app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    let {username} = request
    const {tweetId} = request.params
    const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
    const getuserid = await db.get(getuserquery)
    const getQuery = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getuserid.user_id}`
    const following_id = await db.all(getQuery)
    let detailid = following_id.map(id => convertDbObjectToResponseObject2(id))
    let user = `SELECT user_id FROM tweet WHERE tweet_id= ${tweetId}`
    const userdb = await db.get(user)
    if (detailid.includes(userdb.user_id)) {
      const tweet = `SELECT user.name,reply.reply
    FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id
    INNER JOIN user ON user.user_id = reply.user_id
    WHERE tweet.tweet_id=${tweetId};`
      const tweetresponse = await db.all(tweet)
      let likes_username = tweetresponse.map(id =>
        convertDbObjectToResponseObject6(id),
      )
      response.send({replies: likes_username})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

//user tweet
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  let {username} = request
  const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
  const getuserid = await db.get(getuserquery)
  const user_tweet = `SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replys,tweet.date_time
  FROM tweet LEFT JOIN user ON user.user_id = tweet.user_id LEFT JOIN like ON tweet.tweet_id=like.tweet_id LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id
  WHERE user.user_id=${getuserid.user_id}
  GROUP BY tweet.tweet_id
  ORDER BY tweet.tweet_id DESC`
  const tweetdb = await db.all(user_tweet)
  response.send(tweetdb.map(id => convertDbObjectToResponseObject5(id)))
})
// post method

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  let {username} = request
  const {tweet} = request.body
  const date = new Date()
  const datetime =
    date.getFullYear() +
    '-' +
    date.getMonth() +
    '-' +
    date.getDate() +
    ' ' +
    date.getHours() +
    ':' +
    date.getMinutes() +
    ':' +
    date.getSeconds()
  const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
  const getuserid = await db.get(getuserquery)
  const user_id = getuserid.user_id
  const tweetpost = `INSERT INTO tweet(tweet,user_id,date_time) 
  VALUES('${tweet}',${user_id},'${datetime}')`
  await db.run(tweetpost)
  response.send('Created a Tweet')
})
//delete
app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    let {username} = request
    const {tweetId} = request.params
    const getuserquery = `SELECT user_id FROM user WHERE username='${username}'`
    const getuserid = await db.get(getuserquery)
    const getQuery = `SELECT user_id FROM tweet 
  WHERE tweet_id=${tweetId}`
    const following_id = await db.get(getQuery)
    if (getuserid.user_id === following_id.user_id) {
      const query = `DELETE FROM tweet WHERE tweet_id = ${tweetId}`
      await db.run(query)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

module.exports = app
