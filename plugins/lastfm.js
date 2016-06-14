'use strict';

const fs = require('fs');

const request = require('request');

function loadLastfmData() {
	let data;
	try {
		data = require('../data/lastfm.json');
	} catch (e) {}

	if (typeof data !== 'object' || Array.isArray(data)) data = {};

	return data;
}

function writeLastfmData() {
	let toWrite = JSON.stringify(Data.lastfm);
	fs.writeFileSync('./data/lastfm.json', toWrite);
}

Databases.addDatabase('lastfm', loadLastfmData, writeLastfmData);

const API_ROOT = 'http://ws.audioscrobbler.com/2.0/';
const YT_ROOT = 'https://www.googleapis.com/youtube/v3/search';
const VIDEO_ROOT = 'https://youtu.be/';

module.exports = {
	commands: {
		lastfm(userstr, room, message) {
			if (!canUse(userstr, 1)) return {pmreply: "Permission denied."};

			if (!Config.lastfmKey) return errorMsg("No last.fm API key found.");

			let userid = toId(userstr);
			let accountname = message || userstr.substr(1);
			if (!message && (userid in Data.lastfm)) message = Data.lastfm[userid];

			let url = API_ROOT + '?method=user.getrecenttracks&user=' + message + '&limit=1&api_key=' + Config.lastfmKey + '&format=json';
			let req = new Promise(function(resolve, reject) {
				request(url, function (error, response, body) {
					if (error) {
						errorMsg(error);
						reject(error);
					} else {
						resolve(JSON.parse(body));
					}
				});
			});

			return req.then(data => {
				let msg = '';
				if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length) {
					msg += accountname;
					let track = data.recenttracks.track[0];
					if (track['@attr'] && track['@attr'].nowplaying) {
						msg += " is now listening to: ";
					} else {
						msg += " was last seen listening to: ";
					}
					let trackname = '';
					// Should always be the case but just in case.
					if (track.artist && track.artist['#text']) {
						trackname += track.artist['#text'] + ' - ';
					}
					trackname += track.name;
					msg += trackname;
					let yturl = YT_ROOT + '?part=snippet&order=relevance&maxResults=1&q=' + encodeURIComponent(trackname) + '&key=' + Config.youtubekey;
					let yt = new Promise(function(resolve, reject) {
						request(yturl, function (error, response, body) {
							if (error) {
								errorMsg(error);
								reject(error);
							} else {
								resolve(JSON.parse(body));
							}
						});
					});

					return yt.then(video => {
						if (video.error) {
							errorMsg(video.error.message);
							msg = 'Something went wrong with the youtube API.';
						} else if (video.items && video.items.length && video.items[0].id) {
							msg += ' ' + VIDEO_ROOT + video.items[0].id.videoId;
							msg += ' | Profile link: http://www.last.fm/user/' + message;
						}
						return {reply: msg};
					});
				} else if (data.error) {
					return {reply: msg + data.message + '.'};
				} else {
					return {reply: msg + message + ' doesn\'t seem to have listened to anything recently.'};
				}
			});
		},

		registerlastfm(userstr, room, message) {
			if (!message) return {pmreply: "No username entered."};

			let userid = toId(userstr);
			let username = message.replace(/[^A-Za-z0-9-_]/g, '');

			Data.lastfm[userid] = username;

			Databases.writeDatabase('lastfm');

			return {pmreply: "You've been registered as " + username + "."};
		}
	}
};