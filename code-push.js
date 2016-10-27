var modulesLocation = '../modules';
var auth = require(modulesLocation + '/backend/lib/game/api/auth'),
    jsonResponse = require(modulesLocation + '/backend/node_modules/q-json-response'),
    utils = require(modulesLocation + '/backend/lib/utils');

module.exports = function(config) {
    if (config.backend) {

        config.backend.router.post('/codepush', jsonResponse((request) => {
            console.log('request');
            if (JSON.stringify(request.body.modules).length > 2 * 1024 * 1024) {
                return q.reject('code length exceeds 2 MB limit');
            }

            request.body.modules = utils.translateModulesToDb(request.body.modules);

            request.body.branch = request.body.branch || '$activeWorld';



            var query;

            common.storage.db.users.findOne({ email: request.body.email }).then((data) => {
                console.log(data.username + ' pushed new code');
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
        }));
    }
};