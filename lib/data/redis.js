var conf = require('../../config.js').database;

var     redis = require("redis"),
  redisClient = null; //redis.createClient();

var async = require("async");
var sets = require('simplesets');

// If you want Memory Store instead...
// var MemoryStore = require('connect/middleware/session/memory');
// var session_store = new MemoryStore();

var REDIS_PREFIX = '#scrumblr#';

//For Redis Debugging


var db = function(callback) {
	console.log('Opening redis connection to ' + conf.redis);
	redisClient = redis.createClient(conf.redis);

	redisClient.on("connect", function (err) {
		callback();
	});

	redisClient.on("error", function (err) {
		console.log("Redis error: " + err);
	});

};

db.prototype = {
	clearRoom: function(room, callback) {
		redisClient.del(REDIS_PREFIX + '-room:/demo-cards', function (err, res) {
			redisClient.del(REDIS_PREFIX + '-room:/demo-columns', function (err, res) {
				callback();
			});
		});
	},

	// theme commands
	setTheme: function(room, theme) {
		redisClient.set(REDIS_PREFIX + '-room:' + room + '-theme', theme);
	},

	getTheme: function(room, callback) {
		redisClient.get(REDIS_PREFIX + '-room:' + room + '-theme', function (err, res) {
			callback(res);
		});
	},

	// Column commands
	createColumn: function(room, name, callback) {
		redisClient.rpush(REDIS_PREFIX + '-room:' + room + '-columns', name,
			function (err, res) {
	if (typeof callback != "undefined" && callback !== null) callback();
			}
		);
	},

	getAllColumns: function(room, callback) {
		redisClient.lrange(REDIS_PREFIX + '-room:' + room + '-columns', 0, -1, function(err, res) {
			callback(res);
		});
	},

	deleteColumn: function(room) {
		redisClient.rpop(REDIS_PREFIX + '-room:' + room + '-columns');
	},

	setColumns: function(room, columns) {
		//1. first delete all columns
		redisClient.del(REDIS_PREFIX + '-room:' + room + '-columns', function () {
			//2. now add columns for each thingy
			async.forEachSeries(
				columns,
				function( item, callback ) {
					//console.log('rpush: ' + REDIS_PREFIX + '-room:' + room + '-columns' + ' -- ' + item);
					redisClient.rpush(REDIS_PREFIX + '-room:' + room + '-columns', item,
						function (err, res) {
							callback();
						}
					);
				},
				function() {
					//this happens when the series is complete
				}
			);
		});
	},

	saveColumnsSize: function(room, columnsSize){
		redisClient.del(REDIS_PREFIX + '-room:' + room + '-columnsSize')
		redisClient.hmset(REDIS_PREFIX + '-room:' + room + '-columnsSize', columnsSize)
	},

	getColumnsSize: function(room, callback) {
		redisClient.hgetall(REDIS_PREFIX + '-room:' + room + '-columnsSize', function(err, res){ 
			callback(res);
		})
	},
			

	// Card commands
	createCard: function(room, id, card) {
		var cardString = JSON.stringify(card);
		redisClient.hset(
			REDIS_PREFIX + '-room:' + room + '-cards',
			id,
			cardString
		);
	},

	getAllCards: function(room, callback) {
		redisClient.hgetall(REDIS_PREFIX + '-room:' + room + '-cards', function (err, res) {

			var cards = [];

			for (var i in res) {
				cards.push( JSON.parse(res[i]) );
			}

			callback(cards);
		});
	},

	getAllCardsBackup: function(room, num, callback) {
		var key = REDIS_PREFIX + '-room:' + room + '-cards' + num

               	redisClient.hgetall(key, function (err, res) {
                	var cards = [];
	       	        for (var i in res) {
                      	        cards.push( JSON.parse(res[i]) );
	                }
               	        callback(cards);
	       	});
        },

	cardEdit: function(room, id, text) {
		redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', id, function(err, res) {
			var card = JSON.parse(res);
			if (card !== null) {
				card.text = text;
				redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', id, JSON.stringify(card));
			}
		});
	},

	cardSetXY: function(room, id, x, y) {
		redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', id, function(err, res) {
			var card = JSON.parse(res);
			if (card !== null) {
				card.x = x;
				card.y = y;
				redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', id, JSON.stringify(card));
			}
		});
	},

	deleteCard: function(room, id) {
		redisClient.hdel(
			REDIS_PREFIX + '-room:' + room + '-cards',
			id
		);
	},

	addSticker: function(room, cardId, stickerId) {
		redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', cardId, function(err, res) {
			var card = JSON.parse(res);
			if (card !== null) {
                if (stickerId === "nosticker")
                {
                    card.sticker = null;

                    redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', cardId, JSON.stringify(card));
                }
                else
                {
                    if (card.sticker !== null)
                        stickerSet = new sets.Set( card.sticker );
                    else
                        stickerSet = new sets.Set();

                    stickerSet.add(stickerId);

                    card.sticker = stickerSet.array();

                    redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', cardId, JSON.stringify(card));
                }

			}
		});
	},

	setBoardSize: function(room, size) {
		redisClient.set(REDIS_PREFIX + '-room:' + room + '-size', JSON.stringify(size));
	},

	getBoardSize: function(room, callback) {
		redisClient.get(REDIS_PREFIX + '-room:' + room + '-size', function (err, res) {
			callback(JSON.parse(res));
		});
	},



	createBackup: function(room, numBackup) {
		//Decaler les backup si l'on reprend une action apres etre revenu en arriere
		if (numBackup !== 0){
			redisClient.del(REDIS_PREFIX + '-room:' + room + '-cards')
			for (let t=1; t<numBackup; t++){
				redisClient.del(REDIS_PREFIX + '-room:' + room + '-cards-' + t)
			}

			redisClient.hgetall(REDIS_PREFIX + '-room:' + room + '-cards-' + numBackup, function(err, res){
				if (res !== null){
					for (id in res) {
						redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', id, res[id])
					}
				}
			})

			for (let u=numBackup; u<=10; u++){
				redisClient.hgetall(REDIS_PREFIX + '-room:' + room + '-cards-' + u, function(err, res){
					if (res !== null){
						for (id in res) {
							redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards-' + (u - numBackup + 1), id, res[id])
						}
					}
				})
				redisClient.del(REDIS_PREFIX + '-room:' + room + '-cards-' + u)
			}
		} else {

			//Creer les backup
		
			for (let i=9; i >= 0; i--){
				let num = ""
				if (i !== 0){
					num = "-" + i
				}
				redisClient.del(REDIS_PREFIX + '-room:' + room + '-cards-' + (i + 1))
				redisClient.hgetall(REDIS_PREFIX + '-room:' + room + '-cards' + num, function(err, res){
					if (res !== null){
						for (id in res) {
							redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards-' + (i + 1), id, res[id])
						}
					}
				})
			}
		}
	},

	setNumBackup: function (room, numbackup){
		redisClient.set(REDIS_PREFIX + '-room:' + room + '-numBackup', numbackup)
	},

	getNumBackup: function(room, callback) {
                redisClient.get(REDIS_PREFIX + '-room:' + room + '-numBackup', function (err, res) {
                        callback(JSON.parse(res));
                });
        }

};
exports.db = db;
