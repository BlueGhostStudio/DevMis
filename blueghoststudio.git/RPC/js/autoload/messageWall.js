function construct ()
{
    JS.loadModule ('jsDB');
    DB.open ({driver:'QSQLITE', dbName:'mw'});
    JS.query = DB.newQuery ();
}
function addMessage (proc, wallId, nick, message)
{
    message = message.replace (/"/g, '""');
    message = message.replace (/'/g, "''");
    console.log ('INSERT INTO message (wid,nick,text) VALUES ('
                   + wallId + ','
                   + '"' + nick + '",'
                   + '"' + message + '")');
    JS.query.exec ('INSERT INTO message (wid,nick,text) VALUES ('
                   + wallId + ','
                   + '"' + nick + '",'
                   + '"' + message + '")');
    JS.emitSignal ('newMessage', [nick, message, wallId]);
}

function loadWall (proc, wallID, wallTitle) {
    JS.addProc (proc);
    var wall = JS.query.fetch ('SELECT * FROM wall WHERE id=' + wallID);
    if (wall.length === 0) {
        if (wallTitle === undefined)
            wallTitle = 'Message Wall'
        JS.query.exec ('REPLACE INTO wall (id,title) VALUES ('
                       + wallID + ',"' + wallTitle + '")');
        return [wallTitle, []];
    } else {
        if (wallTitle)
            JS.query.exec ('UPDATE wall SET title="' + wallTitle + '" WHERE id=' + wallID);
        else
            wallTitle = wall[0].title;
        var messages = JS.query.fetch ('SELECT * FROM message WHERE wid=' + wallID);
        return [wallTitle, messages];
    }
}
