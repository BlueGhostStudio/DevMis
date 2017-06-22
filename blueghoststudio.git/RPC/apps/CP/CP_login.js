function login (proc) {
}

function getUsrInfo (proc) {
    console.log ('in getUsrInfo');
    var debate = RPC.objects['debate'];
    console.log ('>>>>>' + debate.__NAME__);
    proc.setPrivateData (debate, 'test', 'this is a test');
    console.log ('>>>>>' + proc.privateData (date, 'test'));
}
