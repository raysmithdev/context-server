const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {SECRET} = require('./config');

//Device schema requires that the device name be unique and is required, is a child of the user schema
const recentSearchesSchema = mongoose.Schema({
  searchURL: {type: String, required: [true, "can't be blank"]},
  dateCreated: {type: Number, default: Date.now}
}, {timestamps: true});

//User schema is requires that usernames and emails are unique and required
const userSchema = mongoose.Schema({
  username: {type: String, required: [true, "can't be blank"], unique: true},
  email: {type: String, required: [true, "can't be blank"], match: [/\S+@\S+\.\S+/, 'is invalid'], unique: true},
  hash: String,
  salt: String,
  recentSearches: [recentSearchesSchema]
}, {timestamps: true});

//Encrypts password via crypto before seeding into the database
userSchema.methods.setPassword = function(password){
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

//Generates the token for a when a user logs in, creates, updates, or deletes a user
userSchema.methods.generateJWT = function() {
  var today = new Date();
  var exp = new Date(today);
  //jwt will expire in 1 day
  exp.setDate(today.getDate() + 1);

  return jwt.sign({
    id: this._id,
    username: this.username,
    exp: parseInt(exp.getTime() / 1000),
  }, SECRET);
};

//Generates JSON to be sent to client when user info is created or updated or deleted
userSchema.methods.toAuthJSON = function(){
  
  return {
    token: this.generateJWT(),
    email: this.email,
    username: this.username
  };
};

//Check when the user's password encrypts to the same hash when the same parameters are use, if true its the same password
userSchema.methods.validPassword = function (password, user){
  return user.hash===crypto.pbkdf2Sync(password, user.salt, 10000, 512, 'sha512').toString('hex')
};

//Child schemas do not get their own instance methods, have to assign them to the parent
//JSON to be sent to the client after a new device created or updated or deleted
userSchema.methods.toAuthSearchesJSON = function(){

  return this.recentSearches.map(function(search){
    return {
      searchURL: search.searchURL,
      dateCreated: search.dateCreated,
      searchID: search._id
    };
  },this);
};
userSchema.methods.toAuthOldestSearchJSON = function (search) {
  return {
    searchURL: search.searchURL,
    dateCreated: search.dateCreated,
    searchID: search._id
  };
};

//the unique validator plugin has to be added prior to assigning the schema to the const User, fyi
userSchema.plugin(uniqueValidator);

//As of Mongoose v4.9.7, child schemas don't get assigned to their own model
const User = mongoose.model('User', userSchema);

module.exports = User;