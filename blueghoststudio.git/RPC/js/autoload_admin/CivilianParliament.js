function construct ()
{
//    JS.loadJsScript ('../../apps/CP/misFun.js');
    JS.loadModule ('jsDB');

//    JS.initDB ();
    DB.open ({ driver: 'QSQLITE', dbName: 'CP' });
    JS.query = DB.newQuery ();
//     createModule ('CP_login');
    createModule ('billEdit');
    createModule ('debate');
}

function createModule (module)
{
    RPC.creatorObject ('JSEngine', module);
    RPC.objects[module].callMethod (null, 'loadJsScript', [0, '../../apps/CP/' + module + '.js']);
}

function guest (proc) {
    var lastGuestID = JS.query.fetch ('SELECT IFNULL(id, 0) + 1 AS id, count() FROM guest_last_id')[0].id;
    var guestID = '-' + lastGuestID.toString();
    var guestDisplayName = '遊客#' + lastGuestID;

    JS.query.exec ("INSERT INTO gplus_usrinfo (id, display_name, img) VALUES ('" + guestID + "', '" + guestDisplayName + "', '')");
    JS.query.exec ('UPDATE guest_last_id SET id=' + lastGuestID);

    console.log (lastGuestID);
    var cpModule = [RPC.objects['debate'], RPC.objects['billEdit']];
    for (var x in cpModule) {
        proc.setPrivateData (cpModule[x], 'usr', 'guest123');
        proc.setPrivateData (cpModule[x], 'displayName', '测试的匿名者');
        proc.setPrivateData (cpModule[x], 'usrImg', '');
    }
    proc.emitSignal (JS, 'login',
                     [true, 3, { author: guestID, displayName: guestDisplayName, usrImg: '' }]);
}
