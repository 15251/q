/**
 * This class manages notifications to TAs after they have helped a student
 * for a given amount of time. This is to help with remote OH to ping TAs who
 * have stayed with students for long periods of time.
 * 
 * Active TAs are checked each minute after init() has been called to 
 * check whether they should receive a notification. Because of this, 
 * notifications may be off by up to 1 minute (although, this should make little 
 * difference from the perspective of the TA).
 * 
 * The proposed alternative was having a timer running for each TA once they
 * start helping, but that appeared to be more inefficient
 */

var Sequelize = require('sequelize');

var model = require("./model.js");
var realtime = require("./realtime.js");
var options = require("./routes/options.js");

/** Number of milliseconds in a minute */
const one_min_ms = 60 * 1000;

var helping_tas_cache = null;

exports.clear_helping_tas_cache = function() {
    helping_tas_cache = null;
}

exports.init = function() {
    // Set an interval to run every minute from the time the timer is started
    setInterval(() => {
        var now = new Date();
        
        // Find all actively helping TAs
        Sequelize.Promise.props({
            notif_time_threshold: options.notif_time_threshold(),
            notif_time_interval: options.notif_time_interval(),
            tas: function() {
                if (helping_tas_cache) {
                    return Promise.resolve(helping_tas_cache);
                }

                return model.TA.findAll({
                    where: {"helping_id": {[Sequelize.Op.not]: null}},
                    include: [{model: model.Entry, as: "helping_entry"}]
                });
            }()
        }).then(function(results) {
            console.log(results.notif_time_interval);
            console.log(results.notif_time_threshold);
            
            helping_tas_cache = results.tas; // Update cache
            if (results.notif_time_threshold == 0) throw new Error(); // Notifs are disabled, do nothing
            if (results.tas.length == 0) throw new Error(); // No TAs helping, do nothing

            // Check each currently helping TA on their help time
            results.tas.forEach(function(ta) {
                var student_help_time = ta.helping_entry.help_time;
                var ms_elapsed = now - student_help_time;
                var min_elapsed = Math.floor(ms_elapsed/one_min_ms);
                var min_past_threshold = min_elapsed - results.notif_time_threshold;

                if (results.notif_time_interval == 0 && min_past_threshold == 0) {
                    // No repeating notifs; only the original one
                    realtime.notifytime(ta.helping_entry.ta_id, min_elapsed);
                } 
                else if (min_past_threshold >= 0 && min_past_threshold % results.notif_time_interval == 0) {
                    // Repeating notifs
                    realtime.notifytime(ta.helping_entry.ta_id, min_elapsed); //TODO: pass a list instead? single call to realtime rather than many
                }
            });
        }).catch(function() {
            return; // Do nothing on errors
        });
    }, one_min_ms);
};
