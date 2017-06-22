JS.billIDCount;

function jsIdentify (proc, method, args)
{
    var author = proc.privateData (JS, 'usr');
    if (proc.privateData (JS, 'usr')) {
        switch (args[0]) {
        case 'addBill':
        case 'billList':
            return true;
        case 'openBill':
        case 'deleteBill':
        case 'changeBillTitle':
        case 'addSection':
        case 'editSection':
        case 'deleteSection':
        case 'changeSeq':
        case 'saveBill':
        case 'closeBill':
            if (JS.query.fetch ('SELECT author FROM bill WHERE id='
                + args[1])[0].author == author)
                return true;
            else
                return false;
        }
    } else if (args[0] == 'getLoginState' || args[0] == 'login')
        return true;
    else
        return false;
}

function construct ()
{
    JS.loadScript ('../../apps/CP/misFun.js');
    JS.loadModule ("jsDB");
    JS.loadModule ("jsHttp");

    JS.initDB ();
    JS.billIDCount = JS.query.fetch ('SELECT MAX(id) AS id FROM bill')[0].id;
}

function billList (proc) {
    return JS.query.fetch ('SELECT * FROM bill WHERE author="' + proc.privateData (JS, 'usr') + '"');
}

function addBill (proc) {
    JS.billIDCount++;

    return JS.billIDCount;
}

function deleteBill (proc, bill_id) {
    JS.query.exec ('DELETE FROM bill WHERE id=' + bill_id);
    closeBill (bill_id);
}

function openBill (proc, bill_id)
{
    var tmpBillTable = JS.tempBTName (bill_id);
    var tmpBillSectionTable = JS.tempBSTName (bill_id);

    if (!JS.existTempTable (tmpBillSectionTable))
        JS.query.exec ('CREATE TEMPORARY TABLE ' +
                tmpBillSectionTable +
                ' AS SELECT id,bill_id,seq,header,text FROM section WHERE bill_id=' +
                bill_id);

    if (!JS.existTempTable (tmpBillTable))
        JS.query.exec ('CREATE TEMPORARY TABLE ' + tmpBillTable + ' AS ' +
                        'SELECT ' +
                        'CASE WHEN count()=0 THEN ' + bill_id + ' ELSE id END AS id, ' +
                        'CASE WHEN count()=0 THEN "no title" ELSE title END AS title, ' +
                        'CASE WHEN count()=0 THEN "' + proc.privateData (JS, 'usr') + '" ELSE author END AS author ' +
                        'FROM bill WHERE id=' + bill_id);

    return [JS.query.fetch ('SELECT * FROM ' +
            tmpBillTable +
            ' WHERE id=' +
            bill_id)[0],
    JS.query.fetch ('SELECT * FROM ' +
            tmpBillSectionTable +
            ' WHERE bill_id=' +
            bill_id + ' ORDER BY seq')];
}

function changeBillTitle (proc, bill_id, title) {
    JS.query.exec ('UPDATE ' + JS.tempBTName (bill_id) + ' SET title=\'' + JS.escape (title, "'") + '\' WHERE id=' + bill_id);
}

function addSection (proc, bill_id, header, text)
{
    var tmpBillSectionTable = JS.tempBSTName (bill_id);
    var maxValue = function (field) {
            return '(SELECT IFNULL(MAX(' + field + '),0) FROM ' + tmpBillSectionTable + ' WHERE bill_id=' + bill_id +') + 1';
    }
    JS.query.exec ('INSERT INTO ' + tmpBillSectionTable + ' SELECT ' + maxValue ('id') + ' AS id, ' +
                    bill_id + ' AS bill_id, ' + maxValue ('seq') + ' AS seq, \'' +
                    JS.escape (header, "'") + '\' AS header, \'' +
                    JS.escape (text, "'") + '\' AS text');

    return JS.query.fetch ('SELECT id, seq FROM ' + tmpBillSectionTable + ' WHERE ROWID=last_insert_rowid()')[0];
}

function editSection (proc, bill_id, id, header, text)
{
    JS.query.updateRecord (JS.tempBSTName (bill_id), {bill_id: bill_id, id: id}, {header: header, text: text});
}

function deleteSection (proc, bill_id, id)
{
    var tmpBillSectionTable = JS.tempBSTName (bill_id);
    JS.query.exec ('UPDATE ' + tmpBillSectionTable + ' SET seq=seq-1 WHERE bill_id=' + bill_id + ' AND seq > (SELECT seq FROM ' + tmpBillSectionTable + ' WHERE bill_id=' + bill_id + ' AND id=' + id + ')');
    JS.query.deleteRecord (tmpBillSectionTable, {bill_id: bill_id, id: id});
}

function changeSeq (proc, bill_id, id, seq)
{
    var tmpBillSectionTable = JS.tempBSTName (bill_id);
    JS.query.exec ('UPDATE ' + tmpBillSectionTable + ' SET seq=seq-1 WHERE bill_id=' + bill_id + ' AND seq>(SELECT seq FROM ' + tmpBillSectionTable + ' WHERE bill_id=' + bill_id + ' AND id=' + id + ')');
    JS.query.exec ('UPDATE ' + tmpBillSectionTable + ' SET seq=seq+1 WHERE bill_id=' + bill_id + ' AND seq>=' + seq);
    JS.query.exec ('UPDATE ' + tmpBillSectionTable + ' SET seq=' + seq + ' WHERE bill_id=' + bill_id + ' AND id=' + id);
}

function saveBill (proc, bill_id)
{
    var tmpBillTable = JS.tempBTName (bill_id);
    JS.query.exec ('UPDATE bill SET ' +
                            'title=(SELECT title FROM ' + tmpBillTable + ' WHERE id=bill.id) ' +
                            'WHERE id=' + bill_id);
    JS.query.exec ('INSERT INTO bill SELECT * FROM ' + tmpBillTable + ' WHERE id NOT IN (SELECT id FROM bill WHERE id=' + bill_id + ')');

    var tmpBillSectionTable = JS.tempBSTName (bill_id);

    JS.query.exec ('DELETE FROM section WHERE bill_id=' + bill_id + ' AND id NOT IN (SELECT id FROM ' + tmpBillSectionTable + ')');
    JS.query.exec ('UPDATE section SET ' +
                    'seq=(SELECT seq FROM ' + tmpBillSectionTable + ' WHERE bill_id=section.bill_id AND id=section.id),' +
                    'header=(SELECT header FROM ' + tmpBillSectionTable + ' WHERE bill_id=section.bill_id AND id=section.id),' +
                    'text=(SELECT text FROM ' + tmpBillSectionTable + ' WHERE bill_id=section.bill_id AND id=section.id) ' +
                    'WHERE bill_id=' + bill_id);
    JS.query.exec ('INSERT INTO section SELECT * FROM ' + tmpBillSectionTable + ' WHERE id NOT IN (SELECT id FROM section WHERE bill_id=' + bill_id + ');');
}

function closeBill (proc, bill_id)
{
    JS.query.exec ('DROP TABLE ' + JS.tempBTName (bill_id));
    JS.query.exec ('DROP TABLE ' + JS.tempBSTName (bill_id));
}

function login (proc, state, accessToken, code)
{
    return JS.login (proc, state, accessToken, code);
}

function getLoginState (proc) {
    return JS.getLoginState (proc);
}

