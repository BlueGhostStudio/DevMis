var ERR_LOGIN=0;
var ERR_STANCE=1;
var ERR_CONTEXT=2;
var ERR_MULTIMENTION=3;
function jsIdentify (proc, method, args)
{
    if (args[0] == 'login' || args[0] == 'guest' || args[0] == 'getLoginState')
        return true;

    var info = procBaseInfo (proc);
    console.log (info.author);
    if (args[0] == 'modifyBillSection') {
        var bill = JS.query.fetch ('SELECT * FROM ' + JS.tempBTName (info.bill_id)) [0];
        if (bill.author == info.author)
            return true;
        else
            return false;
    } else if (info.author < 0) {
        if (args[0] == 'openSession' || (args[0] == 'addDebate' && args[1] == 'R'))
            return true;
        else
            return false;
    } else
        return true;
}

function construct ()
{
    JS.loadScript ('../../apps/CP/misFun.js');
    JS.loadModule ("jsDB");
    JS.loadModule ("jsHttp");

    JS.initDB ();

    JS.maxIDs = JS.query.fetch ('SELECT MAX(a.id) AS de, MAX(b.id) AS sup, MAX(c.id) AS snd FROM debate AS a, support AS b, seconded AS c')[0];

    JS.sessions = new Array;

    JS.onRelProcRemoved (exitSession);
}

function destory ()
{
    console.log ("destory the Object of debate");
    for (var x in JS.sessions) {
        var TBT = JS.tempBTName (x); // bill table
        var TBST = JS.tempBSTName (x); // bill section table
        var TBDT = JS.tempBDTName (x); // bill debate table
        var TBSECT = JS.tempBSECTName (x); // bill seconded table
        var TBSUPT = JS.tempBSUPTName (x); // bill supprt table

        JS.query.exec ('DELETE FROM debate WHERE bill_id=' + x);
        JS.query.exec ('INSERT INTO debate SELECT * FROM ' + TBDT);
        JS.query.exec ('DELETE FROM seconded WHERE bill_id=' + x);
        JS.query.exec ('INSERT INTO seconded SELECT * FROM ' + TBSECT);
        JS.query.exec ('DELETE FROM support WHERE bill_id=' + x);
        JS.query.exec ('INSERT INTO support SELECT * FROM ' + TBSUPT);
    }
}

function emitSignal (proc, bill_id, sig, data, extend) {
    console.log ('emitSignal', bill_id, sig, data, extend);
    var procs = JS.sessions[bill_id];
    for (var x in procs) {
        if (extend == undefined || procs[x].privateData (JS, 'usr') != extend)
            procs[x].emitSignal (JS, sig, [data]);
    }
}

/*function checkLogin (proc)
{
    var author = proc.privateData (JS, 'usr');
    return author;
}*/

function checkUsrStance (sec_id, info)
{
    var VSTAN = JS.viewTableName ('stance', info.bill_id);
    return JS.query.fetch ('SELECT * FROM ' +
                           VSTAN + ' WHERE sec_id=' + sec_id +
                           ' AND author="' + JS.escape (info.author, '"') + '"').length > 0;
}

function procBaseInfo (proc)
{
    var info = new Object;
    info.bill_id = proc.privateData (JS, 'bill_id');
    info.author = /*checkLogin (proc)*/proc.privateData (JS, 'usr');
    info.displayName = proc.privateData (JS, 'displayName');
    info.usrImg = proc.privateData (JS, 'usrImg');

    return info;
}

/*function enterDebateSession (proc)
{
    var state = JS.query.fetch ('SELECT HEX(RANDOMBLOB(16)) AS token')[0].token;
    proc.setPrivateData (JS, 'state', state);

    return state;
}*/

function login (proc, state, accessToken, code)
{
/*    if (state != proc.privateData (JS, 'state'))
        return false;

    proc.setPrivateData (JS, 'code', code);
    proc.setPrivateData (JS, 'access_token', accessToken);

    var postData =  'code=' + code
        + '&client_secret=WMe4tLxvh-7v_MnD3TSCiVF6'
        + '&client_id=27355506747-16ng9l9u55koanhb13fhkrl2r58ge2dj.apps.googleusercontent.com'
        + '&grant_type=authorization_code'
        + '&redirect_uri=postmessage';
    var http = httpInstance ();
//    http.setProxy (1, "127.0.0.1", 1080);
    http.client = proc;
    proc.emitSignal (JS, 'login', [true, 0]);
    http.post ('https://accounts.google.com/o/oauth2/token', postData,
               {'content-type': 'application/x-www-form-urlencoded'},
               {
                    success: function (data) {
                        console.log ('验证身份');
                        var client = this.http.client;
                        var token = JSON.parse(data);
                        if (token.access_token != client.privateData (JS, 'access_token')) {
                            client.emitSignal (JS, 'login', [false, '身份驗證错误']);
                            deleteHttpInstance (this.http);
                            return;
                        }
                        client.emitSignal (JS, 'login', [true, 1]);
                        console.log ("验证成功");
                        this.http.get ('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='
                                       + token.access_token, {},
                                       {
                                           success: function (data) {
                                               var client = this.http.client;
                                               console.log ('获取验证信息');
                                               client.emitSignal (JS, 'login', [true, 2]);
                                               var tokenInfo = JSON.parse (data);
                                               var access_token = client.privateData (JS, 'access_token');
                                               client.setPrivateData (JS, 'usr', tokenInfo.user_id);
                                               this.http.get ('https://www.googleapis.com/plus/v1/people/'
                                                        + tokenInfo.user_id + '?access_token='
                                                        + access_token, {}, {
                                                            success: function (data) {
                                                                console.log ('获取用户信息');

                                                                var client = this.http.client;
                                                                var userInfo = JSON.parse (data);
                                                                var author = userInfo.id;
                                                                var bill_id = client.privateData (JS, 'bill_id');

                                                                client.setPrivateData (JS, 'displayName', userInfo.displayName);
                                                                client.setPrivateData (JS, 'usrImg', userInfo.image.url);
                                                                console.log ('验证流程结束');
                                                                client.emitSignal (JS,
                                                                                   'login', [true, 3, {
                                                                                       author: userInfo.id,
                                                                                       displayName: userInfo.displayName,
                                                                                       usrImg: userInfo.image.url
                                                                                   }]);
                                                                JS.query.exec ("REPLACE INTO gplus_usrinfo (id,display_name,img) VALUES (" +
                                                                               "'" + userInfo.id + "','" +
                                                                               JS.escape (userInfo.displayName, "'") + "','" +
                                                                               JS.escape (userInfo.image.url, "'") + "')");
                                                                deleteHttpInstance (this.http);
                                                            },
                                                            error: function (err, errStr) {
                                                                console.log (err, errStr);
                                                                deleteHttpInstance (this.http);
                                                            }
                                                        });
                                           },
                                           error: function (err, errstr) {
                                               console.log (err, errstr);
                                               deleteHttpInstance (this.http);
                                           }
                                       });
                   }
               });
    return true;*/
    return JS.login (proc, state, accessToken, code);
}

function guest (proc)
{
    var lastGuestID = JS.query.fetch ('SELECT IFNULL(id,0) + 1 AS id, count() FROM guest_last_id')[0].id;
    var guestID = '-' + lastGuestID.toString ();
    var guestDisplayName = '游客#' + lastGuestID;
    proc.setPrivateData (JS, 'usr', guestID);
    proc.setPrivateData (JS, 'displayName', guestDisplayName);
    proc.setPrivateData (JS, 'usrImg', '');
    JS.query.exec ("INSERT INTO gplus_usrinfo (id,display_name,img) VALUES ('" + guestID + "', '" + guestDisplayName + "', '')");
    JS.query.exec ('UPDATE guest_last_id SET id=' + lastGuestID);
    proc.emitSignal (JS, 'login',
                     [true, 3, { author: guestID, displayName: guestDisplayName, usrImg: '' }]);
}

/*function login (proc, author)
{
    var bill_id = proc.privateData (JS, 'bill_id');
    var VSTAN = JS.viewTableName ('stance', bill_id);
    proc.setPrivateData (JS, 'usr', author);
    return [author, JS.query.fetch ('SELECT * FROM ' + VSTAN + ' WHERE author="' + JS.escape (author) + '"')];
}*/

function openSession (proc, bill_id)
{
    console.log ('openSession', bill_id);
    if (JS.query.fetch ('SELECT * FROM bill WHERE id=' + bill_id).length == 0)
        return false;

    var TBT = JS.tempBTName (bill_id); // bill table
    var TBST = JS.tempBSTName (bill_id); // bill section table
    var TBDT = JS.tempBDTName (bill_id); // bill debate table
    var TBSECT = JS.tempBSECTName (bill_id); // bill seconded table
    var TBSUPT = JS.tempBSUPTName (bill_id); // bill supprt table
//    var TSTT = JS.tempSTTName (bill_id); // session_token table

    var VSUPNUM = JS.viewTableName ('support_num', bill_id);
    var VSECNUM = JS.viewTableName ('seconded_num', bill_id);
    var VDD = JS.viewTableName ('debate_detailed', bill_id);
    var VSSS = JS.viewTableName ('section_stance_sum', bill_id);
    var VSD = JS.viewTableName ('section_detailed', bill_id);
    var VSTAN = JS.viewTableName ('stance', bill_id);

    // 以会话建立临时表
    if (!(bill_id in JS.sessions)) {
        console.log ('no exist session');
        JS.sessions[bill_id] = new Array;
        //JS.query.exec ('CREATE TEMPORARY TABLE ' + TSTT + ' (token) ');
        JS.query.exec ('CREATE TEMPORARY TABLE ' + TBT + ' AS ' +
                'SELECT * FROM bill WHERE id=' + bill_id);
        JS.query.exec ('CREATE TEMPORARY TABLE ' + TBST + ' AS ' +
                'SELECT * FROM section WHERE bill_id=' + bill_id);
        JS.query.exec ('CREATE TEMPORARY TABLE ' + TBDT + ' AS ' +
                'SELECT * FROM debate WHERE bill_id=' + bill_id);
        JS.query.exec ('CREATE TEMPORARY TABLE ' + TBSECT + ' AS ' +
                'SELECT * FROM seconded WHERE bill_id=' + bill_id);
        JS.query.exec ('CREATE TEMPORARY TABLE ' + TBSUPT + ' AS ' +
                'SELECT * FROM support WHERE bill_id=' + bill_id);

        // 以会话建立对应的视图

        /*jsDebug ('CREATE TEMPORARY VIEW ' + VSUPNUM + ' AS ' +
                'SELECT a.id AS de_id, count(de_id) AS num ' +
                'FROM ' + TBDT + ' AS a LEFT JOIN ' + TBSUPT + ' AS b ON a.id=b.de_id ' +
                'GROUP BY a.id');
        jsDebug ('CREATE TEMPORARY VIEW ' + VSECNUM + ' AS ' +
                'SELECT a.id AS de_id, count(de_id) AS num ' +
                'FROM ' + TBDT + ' AS a LEFT JOIN '+ TBSECT + ' AS b ON a.id=b.de_id ' +
                'GROUP BY a.id');*/
        JS.query.exec ('CREATE TEMPORARY VIEW ' + VSUPNUM + ' AS ' +
                'SELECT a.id AS de_id, count(de_id) AS num ' +
                'FROM ' + TBDT + ' AS a LEFT JOIN ' + TBSUPT + ' AS b ON a.id=b.de_id ' +
                'GROUP BY a.id');
        JS.query.exec ('CREATE TEMPORARY VIEW ' + VSECNUM + ' AS ' +
                'SELECT a.id AS de_id, count(de_id) AS num ' +
                'FROM ' + TBDT + ' AS a LEFT JOIN '+ TBSECT + ' AS b ON a.id=b.de_id ' +
                'GROUP BY a.id');
        JS.query.exec ('CREATE TEMPORARY VIEW ' + VDD + ' AS ' +
                'SELECT a.id, a.sec_id, a.type, a.author, ' +
                'e.display_name, e.img, ' +
                'a.stance, a.text, ' +
                'a.additional_type, ' +
                /*"CASE WHEN a.type='R' THEN " +
        	        "CASE WHEN a.additional_type='D' THEN a.mention ELSE f.display_name END " +
                'ELSE NULL END AS mention, ' +
                "CASE WHEN a.type='R' AND a.additional_type='D' THEN d.text END AS context, " +*/
                "CASE WHEN a.type='R' THEN a.mention ELSE NULL END AS mention, " +
                "CASE WHEN a.type='R' THEN f.display_name ELSE NULL END AS mention_display_name, " +
                'IFNULL(b.num,0) AS support_num, ' +
                "CASE WHEN a.type='S' " +
                'THEN IFNULL(c.num,0) ELSE NULL END AS seconded_num ' +
                'FROM ' + TBDT + ' AS a LEFT JOIN ' + VSUPNUM + ' AS b ' +
                'ON a.id=b.de_id LEFT JOIN ' + VSECNUM + ' AS c ' +
                'ON a.id=c.de_id LEFT JOIN ' + TBDT + ' AS d ' +
                "ON a.type='R' AND a.additional_type='D' AND a.mention = d.id LEFT JOIN gplus_usrinfo AS e " +
                'ON a.author=e.id LEFT JOIN gplus_usrinfo AS f ' +
                //"ON a.type='R' AND a.additional_type='T' AND a.mention=f.id");
                "ON (a.additional_type='T' AND a.mention=f.id) OR (a.additional_type='D' AND d.author=f.id)");
        JS.query.exec ('CREATE TEMPORARY VIEW ' + VSSS + ' AS ' +
                'SELECT sec_id, stance, SUM(CASE WHEN LENGTH(author)>0 THEN 1 ELSE 0 END)+SUM(seconded_num) AS sum ' +
                'FROM ' + VDD + " WHERE type='S' GROUP BY stance,sec_id");
        JS.query.exec ('CREATE TEMPORARY VIEW ' + VSD + ' AS ' +
                'SELECT bill_id, id, seq, a.header, a.text, ' +
                'IFNULL(`-`, 0) AS `-`, ' +
                //'IFNULL(`-|`, 0) AS `-|`, ' +
                'IFNULL(`|`, 0) as `|`, ' +
                //'IFNULL(`|+`, 0) as `|+`, ' +
                'IFNULL(`+`, 0) AS `+` ' +
                'FROM ' + TBST + ' AS a ' +
                'LEFT JOIN (SELECT sec_id, IFNULL(sum, 0) AS `-` FROM ' + VSSS +
                " WHERE stance='-') AS b ON a.id=b.sec_id " +
                    /*'LEFT JOIN (SELECT sec_id, IFNULL(sum, 0) AS `-|` FROM ' + VSSS +
                    " WHERE stance='-|') AS c ON a.id=c.sec_id " +*/
                    'LEFT JOIN (SELECT sec_id, IFNULL(sum, 0) AS `|` FROM ' + VSSS +
                    " WHERE stance='|') AS d ON a.id=d.sec_id " +
                    /*'LEFT JOIN (SELECT sec_id, IFNULL(sum, 0) AS `|+` FROM ' + VSSS +
                    " WHERE stance='|+') AS e ON a.id=e.sec_id " +*/
                    'LEFT JOIN (SELECT sec_id, IFNULL(sum, 0) AS `+` FROM ' + VSSS +
                    " WHERE stance='+') AS f ON a.id=f.sec_id " +
                'ORDER BY a.seq');
        JS.query.exec ('CREATE TEMPORARY VIEW ' + VSTAN + ' AS ' +
                       'SELECT 0 AS type,a.id AS snd_id, b.sec_id,b.id,b.stance,a.author ' +
                       'FROM ' + TBSECT + ' AS a LEFT JOIN ' + TBDT + ' AS b ON a.de_id=b.id WHERE b.type="S" ' +
                       'UNION ' +
                       'SELECT 1 AS type,NULL AS snd_id, sec_id,id,stance,author FROM ' + TBDT + ' WHERE type="S" AND LENGTH(author)>0');
    }

    proc.setPrivateData (JS, 'bill_id', bill_id);
    enterSession (proc, bill_id);
    /*var usr = proc.privateData (JS, 'usr');*/

    var state = JS.query.fetch ('SELECT HEX(RANDOMBLOB(16)) AS token')[0].token;
    proc.setPrivateData (JS, 'state', state);
    //JS.query.exec ('INSERT INTO ' + TSTT + ' SELECT ' + sessionToken);

    var billInfo = JS.query.fetch ('SELECT * FROM ' + TBT)[0];
    var author = procBaseInfo (proc).author;
    console.log (billInfo.title, (billInfo.author == author));

    return [billInfo.title,
            JS.query.fetch ('SELECT * FROM ' + VSD),
            JS.query.fetch ('SELECT SUM(`-`) AS `-`, ' +
                    //'SUM(`-|`) AS `-|`, ' +
                    'SUM(`|`) AS `|`, ' +
                    //'SUM(`|+`) AS `|+`, ' +
                    'SUM(`+`) AS `+` FROM ' + VSD)[0],
            JS.query.fetch ('SELECT * FROM ' + VDD + ' WHERE LENGTH(text)>0'),
            JS.query.fetch ('SELECT * FROM '
                            + VSTAN
                            + ' WHERE author="' + JS.escape (author, '"') + '"'),
            (billInfo.author == author)];
}

function getLoginState (proc) {
    return JS.getLoginState (proc);
}

function enterSession (proc, bill_id) {
    //proc.callMethod ('CP_login', 'js', ['getUsrInfo']);

    JS.sessions[bill_id].push (proc);
    JS.addProc (proc);
}

function exitSession (proc) {
    var bill_id = proc.privateData (JS, 'bill_id');
    var usr = proc.privateData (JS, 'usr');
    if (usr < 0)
        JS.query.exec ('DELETE FROM gplus_usrinfo WHERE id=' + usr);

    for (var x in JS.sessions[bill_id]) {
        if (JS.sessions[bill_id][x].pID == proc.pID) {
            console.log ('ok');
            JS.sessions[bill_id].splice (x, 1);
            break;
        }
    }
}

function sectionHeader (bill_id, sec_id) {
    return JS.query.fetch ('SELECT header FROM ' + JS.tempBSTName (bill_id) + ' WHERE id=' + sec_id)[0].header;
}

/*
 *            type: 立场(S)或是一般辩论(R)
 *         section: 小节号
 *            text: 内容
 *          stance: 立场
 *         mention: 提及的人或回复的内容id,当为一般辩论(type=R)且与他人互动时
 * additional_type: 回复('D' - Debate),提及某人('T' - To ...)
 */
function addDebate (proc, type, section, text, stance, mention, additional_type)
{
    var info = procBaseInfo (proc);
    /*if (!info.author)
        return [false, ERR_LOGIN];*/

    if (checkUsrStance (section, info) && type == 'S')
        return [false, ERR_STANCE];


    var context = null;
    var mentionDisplayName = null;
    var mentionAuthor = null;
    if (type == 'R') {
        if (additional_type == 'D') {
            var res = JS.query.fetch ('SELECT author, display_name, text FROM ' +
                                      JS.viewTableName ('debate_detailed', info.bill_id) +
                                      ' WHERE id=' + mention + ' AND sec_id=' + section);
            if (res.length > 0) {
                context = res[0].text;
                //mention = res[0].author;
                mentionAuthor = res[0].author;
                mentionDisplayName = res[0].display_name;
            } else
                return [false, ERR_CONTEXT];
        } else if (additional_type == 'T') {
            var res = JS.query.fetch ('SELECT id, display_name ' +
                                      "FROM gplus_usrinfo WHERE display_name='"
                                      + JS.escape (mention, "'") + "'");
            if (res.length == 1) {
                mentionAuthor = mention = res[0].id;
                mentionDisplayName = res[0].display_name;
            } else if (res.length > 1)
                return [false, ERR_MULTIMENTION, res];
            else
                return [false, ERR_CONTEXT];
        }
    }

    var TBDT = JS.tempBDTName (info.bill_id);
    JS.maxIDs.de++;
    JS.query.exec ('INSERT INTO ' + TBDT +
                   ' ("id", "bill_id", "sec_id", "type", "additional_type", "author", "stance", "text", "mention") ' +
                   'VALUES (' +
                            JS.maxIDs.de + ',' +
                            info.bill_id + ',' +
                            section + ',' +
                            '"' + type + '",' +
                            (additional_type ? '"' + additional_type + '"' : 'NULL') + ',' +
                            '"' + JS.escape (info.author, '"') + '",' +
                            '"' + stance + '",' +
                            '"' + JS.escape (text, '"') + '",' +
                            (mention ? '"' + JS.escape (mention, '"') + '"' : 'NULL') + ')');
/*    var context = null;
    if (type == 'R' && additional_type == 'D') {
        var res = JS.query.fetch ('SELECT author, text FROM ' + JS.viewTableName ('debate_detailed', info.bill_id) + ' WHERE id=' + mention)[0];
        context = res.text;
        mention = res.author;
    }*/


    emitSignal (proc, info.bill_id, 'addedDebate',
                {
                    id: JS.maxIDs.de,
                    bill_id: info.bill_id,
                    sec_id: section,
                    type: type,
                    display_name: info.displayName,
                    img: info.usrImg,
                    author: info.author,
                    stance: stance,
                    text: text,
                    context: context,
                    mention: mention,
                    mention_author: mentionAuthor,
                    additional_type: (additional_type ? additional_type : ''),
                    mention_display_name: mentionDisplayName });
    sectionHeader (info.bill_id, section);
    if (type == 'S')
        emitSignal (proc, info.bill_id, 'realtimeMessage',
                    {
                        action: 'addDebate',
                        bill_id: info.bill_id,
                        sec_id: section,
                        de_id: JS.maxIDs.de,
                        section_header: sectionHeader (info.bill_id, section),
                        author: info.author,
                        display_name: info.displayName,
                        stance: stance
                    });
    else if (mention != undefined)
        emitSignal (proc, info.bill_id, 'realtimeMessage',
                    {
                        action: 'debateWith',
                        bill_id: info.bill_id,
                        sec_id: section,
                        de_id: JS.maxIDs.de,
                        section_header: sectionHeader (info.bill_id, section),
                        author: info.author,
                        mention: mentionDisplayName,
                        display_name: info.displayName,
                        stance: stance
                    });
    return true;
}

function removeStance (proc, section)
{
    var info = procBaseInfo (proc);
    if (!info.author)
        return [false, ERR_LOGIN];

    var TBDT = JS.tempBDTName (info.bill_id);
    var TBSECT = JS.tempBSECTName (info.bill_id);
    var debateRecords = JS.query.fetch ('SELECT * FROM ' +
                                        '(SELECT 0 AS status,id,sec_id,NULL AS snd_id,author,stance FROM ' +
                                        TBDT + ' WHERE id NOT IN (SELECT de_id FROM ' + TBSECT + ') AND type="S" ' +
                                        'UNION ALL ' +
                                        'SELECT 1 AS status,id,sec_id,NULL AS snd_id,author,stance FROM ' +
                                        TBDT + ' WHERE id IN (SELECT de_id FROM ' + TBSECT + ') AND type="S" ' +
                                        'UNION ALL ' +
                                        'SELECT CASE WHEN LENGTH(b.author)>0 THEN 2 ELSE 3 END AS status,a.de_id,b.sec_id,a.id AS snd_id,a.author,b.stance FROM ' +
                                        TBSECT + ' AS a LEFT JOIN ' + TBDT + ' AS b ON a.de_id=b.id ' +
                                        ') WHERE sec_id=' + section + ' AND author="' + JS.escape (info.author, '"') + '"');
    for (var x in debateRecords) {
        if (debateRecords[x].status == 0) { // 立场没有任何附议，删除记录
            JS.query.exec ('DELETE FROM ' + TBDT + ' WHERE id=' + debateRecords[x].id);
        } else if (debateRecords[x].status == 1) { // 存在附议，清空作者
            JS.query.exec ('UPDATE ' + TBDT + ' SET author=NULL WHERE id=' + debateRecords[x].id);
        } else if (debateRecords[x].status == 2 || debateRecords[x].status == 3) {
            JS.query.exec ('DELETE FROM ' + TBSECT + ' WHERE id=' + debateRecords[x].snd_id);
            if (debateRecords[x].status == 3) { // 原作者已删除他的立场
                if (JS.query.fetch ('SELECT COUNT() AS count FROM ' + TBSECT + ' WHERE de_id=' + debateRecords[x].id)[0].count == 0) { // 若是附议数为0删除立场
                    console.log ('orig debate no author');
                    JS.query.exec('DELETE FROM ' + TBDT + ' WHERE id=' + debateRecords[x].id);
                } else
                debateRecords[x].status = 2;
            }
        }
        emitSignal (proc, info.bill_id, 'removedStance', {
                        bill_id: info.bill_id,
                         status: debateRecords[x].status,
                          de_id: debateRecords[x].id,
                         author: info.author,
                         stance: debateRecords[x].stance,
                         sec_id: section
                    });
        emitSignal (proc, info.bill_id, 'realtimeMessage',
                    {
                        action: 'giveupStance',
                        bill_id: info.bill_id,
                        sec_id: section,
                        author: info.author,
                        display_name: info.displayName,
                        section_header: sectionHeader (info.bill_id, section)
                    });
    }

    return true;

//SELECT * FROM (
//SELECT 0 AS status,id,sec_id,0 AS snd_id,author FROM debate WHERE id NOT IN (SELECT de_id FROM seconded) AND type='S'
//UNION ALL
//SELECT 1 AS status,id,sec_id,0 AS snd_id,author FROM debate WHERE id IN (SELECT de_id FROM seconded) AND type='S'
//UNION ALL
//SELECT CASE WHEN LENGTH(b.author)>0 THEN 2 ELSE 3 END AS status,a.de_id,b.sec_id,a.id AS snd_id,a.author FROM seconded AS a LEFT JOIN debate AS b ON a.de_id=b.id
//)
//WHERE sec_id=2 AND author='Blue Ghost';
}

function seconded (proc, debate)
{
    var info = procBaseInfo (proc);

    /*if (!info.author)
        return [false, ERR_LOGIN];*/

    var debateRecord = JS.query.fetch ('SELECT sec_id, stance, author, id, display_name, img FROM ' +
                                       JS.viewTableName ('debate_detailed', info.bill_id) +
                                       ' WHERE id=' + debate)[0];
    var sec_id = debateRecord.sec_id;
    if (checkUsrStance (sec_id, info, true))
        return [false, ERR_STANCE];


    var TBSECT = JS.tempBSECTName (info.bill_id);
    JS.maxIDs.snd++;
    JS.query.exec ('INSERT INTO ' + TBSECT +
                   ' ("id", "bill_id", "de_id", "author") ' +
                   'VALUES (' +
                   JS.maxIDs.snd + ',' +
                   info.bill_id + ',' +
                   debate + ',' +
                   '"' + JS.escape (info.author, '"') + '")');

    emitSignal (proc, info.bill_id, 'seconded', {
        de_id: debate,
        bill_id: info.bill_id,
        sec_id: sec_id,
        stance: debateRecord.stance,
        author: info.author
    });

    emitSignal (proc, info.bill_id, 'realtimeMessage',
                {
                    action: 'seconded',
                    bill_id: info.bill_id,
                    de_id: debate,
                    author: info.author,
                    display_name: info.displayName,
                    de_author: debateRecord.author,
                    de_display_name: debateRecord.display_name,
                    sec_id: sec_id,
                    section_header: sectionHeader (info.bill_id, sec_id)
                });

    return true;
}

function support (proc, debate) {
    var info = procBaseInfo (proc);
    if (!info.author)
        return [false, ERR_LOGIN];

    var TBSUPT = JS.tempBSUPTName (info.bill_id);
    JS.maxIDs.sup++;
    var authorSqlValue = '"' + JS.escape (info.author, '"') + '"';
    var increase = 1;
    if (JS.query.fetch ('SELECT count () AS has_sup FROM ' +
        TBSUPT +
        ' WHERE de_id=' + debate +
        ' AND author=' + authorSqlValue) [0].has_sup > 0) {
        console.log ('remove');
        JS.query.exec ('DELETE FROM ' + TBSUPT + ' WHERE de_id=' + debate + ' AND author=' + authorSqlValue);
        increase = -1;
    } else {
        console.log ('add');
        JS.query.exec ('INSERT INTO ' + TBSUPT + ' ("id", "bill_id", "de_id", "author") ' +
            'VALUES (' + JS.maxIDs.sup + ',' +
            info.bill_id + ',' +
            debate + ',' +
            authorSqlValue + ')');
    }

    emitSignal (proc, info.bill_id, 'support', {
        de_id: debate,
        bill_id: info.bill_id,
        increase: increase
    });

    return true;
}

function whoStance (proc, section, stance)
{
    return JS.query.fetch ('SELECT a.author, b.display_name FROM ' +
                           JS.viewTableName ('stance', procBaseInfo (proc).bill_id) + ' AS a LEFT JOIN gplus_usrinfo AS b ON a.author = b.id'
                           + ' WHERE sec_id=' + section + ' AND stance="' + stance + '"');
}

function whoSeconded (proc, debate)
{
    return JS.query.fetch ('SELECT a.author, b.display_name FROM ' + JS.tempBSECTName (procBaseInfo (proc).bill_id)
                           + ' AS a LEFT JOIN gplus_usrinfo AS b ON a.author = b.id'
                           + ' WHERE de_id=' + debate);
}

function whoSupport (proc, debate)
{
    return JS.query.fetch ('SELECT a.author, b.display_name FROM '
                           + JS.tempBSUPTName (procBaseInfo (proc).bill_id)
                           + ' AS a LEFT JOIN gplus_usrinfo AS b ON a.author = b.id'
                           + ' WHERE de_id=' + debate);
}


function debaterStance (proc, author, section)
{
    var info = procBaseInfo (proc);
    return JS.query.fetch ('SELECT id FROM ' + JS.viewTableName ('stance', info.bill_id) +
                           ' WHERE author="' + JS.escape (author, '"') + '" AND sec_id=' + section);
}

function modifyBillSection (proc, section, text)
{
    var bill_id = proc.privateData (JS, 'bill_id');
    var TBST = JS.tempBSTName (bill_id);
    JS.query.exec ('UPDATE ' + TBST + " SET text='" + JS.escape (text, "'") + "' WHERE id=" + section);
    emitSignal (proc, bill_id, 'sectionModified', {
        bill_id: bill_id,
        sec_id: section,
        text: text
    }, proc.privateData (JS, 'usr'));
}

