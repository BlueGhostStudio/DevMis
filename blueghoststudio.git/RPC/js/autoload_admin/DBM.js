function testIdentify (proc)
{
    return proc.callMethod ("ctrl", "RPCTypes", []);
}

function construct ()
{
    JS.onRelProcRemoved (exited)
}

function DBMSession (proc)
{
    if (!JS.containsRelProc (proc)) {
        inSession = true;
        /* 增加用户的数据库管理对象 */
        var UDBMName = "UDBM" + proc.pID;
        RPC.creatorObject ("JSEngine", UDBMName);
        var sObj = RPC.objects [UDBMName];
        sObj.callMethod (proc, "loadJsScript", [0, "userDBM.js"]);
        proc.setPrivateData (JS, "UDBM", UDBMName);

        /* 进程与其UDBM绑定 */
        proc.setPrivateData (sObj, "binded", true); // proc 设置 UDBM 对象名

        /* 增加会话 proc, 用于 proc 退出或客户端退出时,清除与其绑定的 UDBM */
        JS.addProc (proc);
    }

    return proc.privateData (JS, "UDBM");
}

function exited (proc)
{
    RPC.removeObject (proc.privateData (JS, "UDBM"));
}

function exit (proc)
{
    JS.removeProc (proc);
}
