var modulesLocation = '../modules';
var auth = require(modulesLocation + '/backend/lib/game/api/auth'),
    jsonResponse = require(modulesLocation + '/backend/node_modules/q-json-response'),
    utils = require(modulesLocation + '/backend/lib/utils'),
    https = require('https');

module.exports = function(config) {
    if (config.backend) {

        config.backend.router.post('/codepush', (request, response) => {
            //Need to authenticate with screeps server
            var reqOptions = {
                hostname: 'screeps.com',
                port: 443,
                path: '/api/auth/signin',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            };
            var req = https.request(reqOptions, function(res) {
                res.setEncoding('utf8');

                var data = '';

                if (res.statusCode == 401) {
                    console.log('Unable to authenticate.');
                    response.json({ ok: 0, error: 'Unable to authenticate.' });
                    return;
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    console.log('Screeps server returned error code ' + res.statusCode);
                    response.json({ ok: 0, error: 'Screeps server returned error code ' + res.statusCode });
                    return;
                }

                res.on('data', function(chunk) {
                    data += chunk;
                });

                res.on('end', function() {
                    try {
                        var parsed = JSON.parse(data);
                        if (parsed.ok) {
                            console.log(parsed);
                            //OK, now we are authenticated. Let's continue...

                            if (JSON.stringify(request.body.modules).length > 2 * 1024 * 1024) {
                                return q.reject('code length exceeds 2 MB limit');
                            }

                            request.body.modules = utils.translateModulesToDb(request.body.modules);

                            request.body.branch = request.body.branch || '$activeWorld';



                            var query;

                            common.storage.db.users.findOne({ email: request.body.email }).then((data) => {
                                console.log(data.username + ' pushed new code');
                                response.json({ ok: 1 });
                                request.user = data;
                                if (request.body.branch[0] == '$') {
                                    var activeName = request.body.branch.substring(1);
                                    query = {
                                        $and: [{ user: request.user._id }, {
                                            [activeName]: true
                                        }]
                                    };
                                } else {
                                    query = { $and: [{ user: request.user._id }, { branch: request.body.branch }] };
                                }

                                return db.users.update({ _id: request.user._id }, { $set: { active: 10000 } })
                                    .then(() => db['users.code'].update(query, {
                                        $set: {
                                            modules: utils.translateModulesToDb(request.body.modules),
                                            timestamp: new Date().getTime()
                                        }
                                    }))
                                    .then((data) => {
                                        if (!data.modified) {
                                            return q.reject('branch does not exist');
                                        }
                                        env.del(`scrScriptCachedData:${request.user._id}`);
                                        db['users.code'].findOne(query)
                                            .then((code) => {
                                                pubsub.publish(`user:${request.user._id}/code`, JSON.stringify({ id: "" + code._id, hash: request.body._hash }))
                                            });
                                    })
                                    .then(() => ({ timestamp: Date.now() }));
                            });
                        } else {
                            console.log('Error authenticating to screeps: ' + util.inspect(parsed));
                            response.json({ ok: 0, error: 'Error authenticating to screeps: ' + util.inspect(parsed) });
                            return;
                        }
                    } catch (e) {
                        console.log('Error while processing json: ' + e.message);
                        response.json({ ok: 0, error: 'Error while processing json: ' + e.message });
                        return;
                    }
                });
            });
            req.write(JSON.stringify({ "email": request.body.email, "password": request.body.password }));
            req.end();
        });
    }
};
