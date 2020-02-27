const express = require('express')
const next = require('next')
const request = require('request'); // "Request" library
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const axios = require('axios');

const port = parseInt(process.env.PORT, 10) || 3000
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

console.log

app.prepare().then(() => {
  const server = express()

  const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
  console.log(CLIENT_ID)

    /**
   * Generates a random string containing numbers and letters
   * @param  {number} length The length of the string
   * @return {string} The generated string
   */
  var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  var stateKey = 'spotify_auth_state';

  server.use(cors())
        .use(cookieParser());

   // Redirect user to spotify for initial login
  server.get('/login', function(req, res) {
    console.log('/login')

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email';
    res.redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        state: state
      }));
  });

  // Handle callback 
  server.get('/callback', function(req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter
  
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;
  
    if (state === null || state !== storedState) {
      res.redirect('/' +
        querystring.stringify({
          error: 'state_mismatch'
        }));
    } else {
      res.clearCookie(stateKey);
      var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        },
        headers: {
          'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
        },
        json: true
      };
  
      request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
  
          var access_token = body.access_token,
              refresh_token = body.refresh_token;
  
          var options = {
            url: 'https://api.spotify.com/v1/me',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          };
  
          // use the access token to access the Spotify Web API
          request.get(options, function(error, response, body) {
            console.log(body);
          });

          res.cookie('refresh_token', refresh_token, { maxAge: 604800000, httpOnly: false });
  
          // we can also pass the token to the browser to make requests from there
          res.redirect('/#' +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token
            }));
        } else {
          res.redirect('/#' +
            querystring.stringify({
              error: 'invalid_token'
            }));
        }
      });
    }
  });

  // setup POST request to get access_token from refresh_token
  const getAccessToken = async (refresh_token) => {
    const data = {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    }

    const options = {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')) },
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify(data)
    }

    const response = await axios(options)
    const access_token = response.data.access_token

    return(access_token)
  }

  // GET user's top tracks
  server.get('/api/tracks', async function(req, res) {

    // requesting access token from refresh token
    const refresh_token = req.query.refresh_token;
    const time_range = req.query.time_range
    const limit = req.query.limit

    const getTracks = async (accessToken) => {
      const options = {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        url: `https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=${limit}`
      }
      const response = await axios(options)
      return(response.data)
    }
    
    const access_token = await getAccessToken(refresh_token)
    // console.log(access_token)

    const tracks = await getTracks(access_token)
    console.log(tracks)
    
    res.json(tracks)
  });

  // GET user's top artists
  server.get('/api/artists', async function(req, res) {

    // requesting access token from refresh token
    const refresh_token = req.query.refresh_token;
    const time_range = req.query.time_range
    const limit = req.query.limit

    const getArtists = async (accessToken) => {
      const options = {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        url: `https://api.spotify.com/v1/me/top/artists?time_range=${time_range}&limit=${limit}`
      }
      const response = await axios(options)
      return(response.data)
    }
    
    const access_token = await getAccessToken(refresh_token)
    // console.log(access_token)

    const artists = await getArtists(access_token)
    console.log(artists)
    
    res.json(artists)
  });

  // GET user's listening history
  server.get('/api/history', async function(req, res){

    const refresh_token = req.query.refresh_token;
    const limit = req.query.limit

    const getHistory = async (accessToken) => {
      const options = {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        url: `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`
      }
      const response = await axios(options)
      return(response.data)
    }

    const access_token = await getAccessToken(refresh_token)
    const history = await getHistory(access_token)
    console.log(history)
    res.json(history)

  })

  // GET user's profile
  server.get('/api/profile', async function(req, res){
    const refresh_token = req.query.refresh_token;
    try{
      const getProfile = async (accessToken) => {
        const options = {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + accessToken },
          url: `https://api.spotify.com/v1/me`
        }
        const response = await axios(options)
        return(response.data)
      }
  
      const access_token = await getAccessToken(refresh_token)
      const profile = await getProfile(access_token)
      console.log(profile)
      res.json(profile)

    } catch(err) {
      res.json(`Error: ${err}`)
    }
  })

  // server.get('/test', (req, res) => {
  //   res.json('test')
  // })

  // server.get('/posts/:id', (req, res) => {
  //   return app.render(req, res, '/posts', { id: req.params.id })
  // })

  server.all('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(port, err => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${port}`)
  })
})
