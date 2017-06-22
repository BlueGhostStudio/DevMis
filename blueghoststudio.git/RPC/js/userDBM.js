function parseFieldAbbr (txt)
{
    txt = txt.replace (/\bpk\b/gi, "primary key");
    return txt;
}

function jsIdentify (proc, method, args)
{
    if (proc.privateData (JS, "binded"))
        return true;
    else
        return false;
}

function DBQueryWithTable (proc, table, cond)
{
    var q = "SELECT * FROM " + table;
    if (cond != undefined)
        q += " WHERE " + cond;

    return [DB.newQuery().fetch (q)];
}

function DBQuery (proc, q)
{
    return [query.fetch (q)];
}

function register (proc, user, pwd)
{
    return [];
}

function createUsrDatabase (proc, dbName, pwd)
{
    if (!dbName.length)
        return false;
    var ok = DB.open ({driver:'QSQLITE', dbName: dbName});
    if (ok && pwd != undefined)
        DB.lockDatabase (pwd);

    return ok;
}

function createUsrTable (proc, tableDef)
{
    if (DB.isOpen ()) {
        var tableName = tableDef.tableName;

        var fieldDefStatem = new String;
        for (var x in tableDef.fields) {
            if (fieldDefStatem.length > 0)
                fieldDefStatem += ', ';

            fieldDefStatem += parseFieldAbbr (tableDef.fields [x]);
        }
        var sqlStatem = 'CREATE TABLE ' + tableName + ' (' + fieldDefStatem + ')';

        var crq = DB.newQuery ();
        if (!crq.exec (sqlStatem))
            return [false, crq.lastQuery + '\n' + crq.lastError];
    } else
        return [false, "No DB has opened"]

    return [true];
}

function openDatabase (proc, database, pwd)
{
    return DB.open ({driver: "QSQLITE", dbName: database, pwd:pwd});
}

function lockDatabase (proc, pwd)
{
    return DB.lockDatabase (pwd);
}

function lockDatabaseByObject (proc)
{
    return DB.lockDatabaseByObject ();
}

function unlockDatabase (proc)
{
    return DB.unlockDatabase ();
}

function openedDB (proc)
{
    return DB.dbName;
}

function closeDB (proc)
{
    DB.close ();
}

function dropTable (proc, tblName)
{
    var dtq = DB.newQuery ();
    if (DB.newQuery ().exec ("DROP TABLE " + tblName + ";"))
        return true;
    else
        return [false, dtq.lastError];
}

function alterTable (proc, fieldAlter, tableDef)
{
    if (DB.isOpen ()) {
        var atq = DB.newQuery ();
        if (!atq.exec ("CREATE TEMPORARY TABLE temp AS SELECT " + fieldAlter + " FROM " + tableDef.tableName + ";\n"))
                return [false, atq.lastQuery + '\n' + atq.lastError];
        if (!atq.exec ("DROP TABLE " + tableDef.tableName + ";\n"))
            return [false, atq.lastQuery + '\n' + atq.lastError];
        var crRet = createUsrTable (proc, tableDef);
        if (!crRet [0])
            return crRet;
        if (!atq.exec ("INSERT INTO " + tableDef.tableName + " SELECT * FROM temp;\n"))
            return [false, atq.lastQuery + '\n' + atq.lastError];
        if (!atq.exec ("DROP TABLE temp;\n"))
            return [false, atq.lastQuery + '\n' + atq.lastError];

        var qwtRet = DBQueryWithTable (proc, "sqlite_master", 'name="' + tableDef.tableName + '"');
        return [true, qwtRet];
    } else
        return [false, "No database has opened"]
}

function renameTable (proc, tableName, newName)
{
    if (DB.isOpen) {
        var rtq = DB.newQuery ();
        jsDebug ("ALTER TABLE " + tableName + " RENAME TO " + newName)
        if (!rtq.exec ("ALTER TABLE " + tableName + " RENAME TO " + newName))
            return [false, rtq.lastQuery + '\n' + rtq.lastError];
        else {
            var qwtRet = DBQueryWithTable (proc, "sqlite_master", 'name="' + newName + '"');
            return [true, qwtRet]
        }
    } else
        return [false, "No database has opened"]
}