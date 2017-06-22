function construct ()
{
    addCMS ('BGMRPC', 'BGMRPC', '781519');
    addCMS ('PF', 'PF', '781519');
    addCMS ('CP_cms', 'CP_cms', '781519');
    addCMS ('blog', 'blog', '781519');
    addCMS ('HRJ', 'HRJ', '123456');
}

function addCMS (name, db, pwd)
{
    RPC.creatorObject ("JSEngine", name);
    var cms = RPC.objects [name];
    cms.callMethod (null, 'loadJsScript', [0, 'cms.js']);
    cms.callMethod (null, 'js', ['setup', db, pwd]);
}
