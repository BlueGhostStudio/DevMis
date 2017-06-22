JS.escape = function (text,quo) {
    if (text != null) {
//    text = text.replace (/\//gi, '//');
        if (quo=="'")
            text = text.replace (/\'/gi, "''");
        else if (quo=='"')
            text = text.replace (/\"/gi, '""');
/*    text = text.replace (/\[/gi, '/[');
    text = text.replace (/\]/gi, '/[');
    text = text.replace (/\%/gi, '/%');
    text = text.replace (/\&/gi, '/&');
    text = text.replace (/\_/, '/_');
    text = text.replace (/\(/gi, '/(');
    text = text.replace (/\)/gi, '/)');*/
    }
    return text;
}

JS.initDB = function () {
    DB.open ({
        driver: 'QSQLITE',
        dbName: 'CP',
        connectName: 'CivilianParliament_QSQLITE_CP'},
        true);
    JS.query = DB.newQuery ();
}

JS.tempTableName = function (bill_id, suffix)
{
    var name = 'tmp_bill' + bill_id;
    if (suffix)
        name += '_' + suffix;

    return name;
}

JS.tempBSTName = function (bill_id) {
    return JS.tempTableName (bill_id, 'section');
}

JS.tempBTName = function (bill_id) {
    return JS.tempTableName (bill_id, '');
}

JS.tempBDTName = function (bill_id) {
    return JS.tempTableName (bill_id, 'debate');
}

JS.tempBSECTName = function (bill_id) {
    return JS.tempTableName (bill_id, 'seconded');
}

JS.tempBSUPTName = function (bill_id) {
    return JS.tempTableName (bill_id, 'support');
}

/*JS.tempSTTName = function (bill_id) {
    return JS.tempTableName (bill_id, 'session_token');
}*/

JS.viewTableName = function (name, bill_id)
{
    var vtn = 'view_bill'+ bill_id +'_' +name;

    return vtn;
}

JS.existTempTable = function (tempTableName)
{
    return JS.query.fetch ('SELECT name FROM sqlite_temp_master WHERE name=\''
            + tempTableName + '\'').length > 0;
}

JS.login = function (proc, state, accessToken, code) {
    if (state != proc.privateData (JS, 'state'))
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
    return true;
}

JS.getLoginState = function (proc) {
    var state = JS.query.fetch ('SELECT HEX(RANDOMBLOB(16)) AS token')[0].token;
    proc.setPrivateData (JS, 'state', state);

    return state;
}
