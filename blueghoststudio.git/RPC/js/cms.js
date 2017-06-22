function jsIdentify (proc, method, args)
{
    if (args [0] === 'setup' && proc)
        return false;
    /*
     * BGMRPC_category.allow 0 允许匿名发布,断线之前可修改 1 只有指定的注册成员可发布,文章作者修改
     * 如果设定为1,而没有指定成员,则为admin
     * 设定为1, admin 无权修改删除任何作者非admin的文章
     * 任何分类都包含admin
     * 设定为0, admin可删除, 但不能修改
     */
//     jsDebug (args [0] + ':' + args[1])
//     jsDebug (proc.privateData (JS, 'usr'))
    var allow = false;

    var usr = proc.privateData (JS, 'usr');
    if (args [0] === 'updateContent'
        || args [0] === 'deleteContent'
        || args [0] === 'changeSeq') {
        jsDebug ('SELECT * FROM CMS_content WHERE id=' + args[1]);
        var result = query.fetch ('SELECT * FROM CMS_content WHERE id=' + args[1]);
        var author = result [0].author;

        if (author === usr)
            allow = true;
        else {
            if (args [0] !== 'updateContent' && author < 0 && usr === 1)
                allow = true;
            else
                allow = false;
        }
    } else if (args [0] === "addContent") {
        if (usr < 0) { // 如果为匿名拥护
            // 检测分类是否允许匿名发布
            if (query.fetch ('SELECT * FROM CMS_category WHERE term="' + args [5] + '"')[0].allow === 0)
                allow = true;
            else
                allow = false;
        } else if (usr === 1) // 如果为admin
            allow = true;
        else { // 如果为注册用户
            if(query.fetch ('SELECT * FROM CMS_cate_allow WHERE term="' + args [5] + '" AND authorID=' + usr).length > 0)
                allow = true;
            else
                allow = false;
        }
    } else
        allow = true;
    return allow;
}


// global Variables
var query;
var lastGuestID = -1;
var framework = new Object;

function construct ()
{
    JS.loadModule ('jsDB');
}

function setup (proc, db, pwd)
{
    DB.open ({driver:"QSQLITE", dbName:db, pwd:pwd});
    query = DB.newQuery ();
}

function sendNotification (proc, signal, args)
{
    proc.emitSignal (JS, signal, args);
}

function getCategories (proc)
{
    var q = 'select term, allow,title from CMS_category';
    return [query.fetch(q)];
}

function getPageFramework (proc, type)
{
    if (!framework [type]) {
        var tempFileName = 'template/' + type + '.html';
        jsDebug (tempFileName);
        var tempFile = new JSFile;
        if (tempFile.open (tempFileName, fileFlag.READONLY | fileFlag.TEXT))
            framework [type] = tempFile.readAll (tempFileName).toString ();
    }

    return framework [type];
}

function updatePageFramework (proc, type, frame)
{
    return query.updateRecord ("CMS_framework", {'type': type}, {'type': type, 'frame': frame});
}

function addContent (proc, cover, header, subheader, summary, content, term, crID)
{
    var maxSeqQuery = 'SELECT MAX(seq) as seq FROM CMS_content';
    if (term.length > 0)
        maxSeqQuery += ' WHERE term="' + term + '"';

    var maxSeq = query.fetch (maxSeqQuery)[0].seq;

    var date = new Date;
    var record = {
        'cover': cover,
        'header': header,
        'subheader': subheader,
        'summary': summary,
        'content': content,
        'published_date': date.toJSON(),
        'term': term,
        'seq': maxSeq + 1,
        'author': proc.privateData (JS, 'usr')
    }
    var nick = proc.privateData (JS, 'nick');
    if (nick)
        record.guest_nick = nick;
    if (query.insertRecord ('CMS_content', record)) {
        console.log ('----------', summary);
        sendNotification (proc, 'addedContent', [{
            id: query.fetch ('SELECT last_insert_rowid() AS id')[0].id,
            cover: cover,
            header: header,
            subheader: subheader,
            summary: summary,
            content: content,
            term: term,
            crID: crID
        }]);
        //sendNotification (proc, 'refreshCategoryArticles', [term]);
        //return [true, query.fetch ('SELECT a.id, a.term,a.published_date,a.seq,a.author,IFNULL(b.nick,a.guest_nick) AS nick FROM CMS_content AS a LEFT JOIN CMS_author AS b ON a.author=b.id WHERE a.id=last_insert_rowid()')[0]];
        return [true];
    } else
        return [false, query.lastError];
}

function reSeq (term, withTransaction)
{
    if (withTransaction === undefined || withTransaction === true)
        query.exec ('BEGIN TRANSACTION;');

    query.exec ('CREATE TEMPORARY TABLE ccs AS SELECT id,term,(SELECT COUNT(*) FROM CMS_content AS a WHERE a.seq <= CMS_content.seq AND a.term="' + term + '") AS seq FROM CMS_content WHERE CMS_content.term="' + term + '";');
    query.exec ('UPDATE CMS_content SET seq=(SELECT seq FROM ccs WHERE ccs.id=CMS_content.id) WHERE CMS_content.term="' + term +'";');
    query.exec ('DROP TABLE ccs;');


    console.log ('CREATE TEMPORARY TABLE ccs AS SELECT id,term,(SELECT COUNT(*) FROM CMS_content AS a WHERE a.seq <= CMS_content.seq AND a.term="' + term + '") AS seq FROM CMS_content WHERE CMS_content.term="' + term + '";');
    console.log ('UPDATE CMS_content SET seq=(SELECT seq FROM ccs WHERE ccs.id=CMS_content.id) WHERE CMS_content.term="' + term +'";');
    console.log ('DROP TABLE ccs;');

    if (withTransaction === undefined || withTransaction === true)
        query.exec ('COMMIT;');
}

function deleteContent (proc, id)
{
    var content = query.fetch ('SELECT * FROM CMS_content WHERE id=' + id);
    var ok = query.exec ('DELETE FROM CMS_content WHERE id=' + id);
    if (ok) {
        var term = content[0].term;
        sendNotification (proc, 'removedContent', [term, id]);
        reSeq (term);
//             JS.emitSignal ('refreshCategoryArticles', [cateID])
        return ok;
    } else
        return [false, query.lastError];
}

function updateContent (proc, id, cover, header, subheader, summary, content, term, isModified, categoryChanged)
{
    var record = {};
    var origTerm;
    var q = 'SELECT * FROM CMS_content WHERE id=' + id;
    if (isModified) {
        record = {
            'cover': cover,
            'header': header,
            'subheader': subheader,
            'summary': summary,
            'content': content
        }
    }
    if (categoryChanged) {
        var result = query.fetch (q)[0];
        origTerm = result.term;
        record.term = term;
    }

    jsDebug (JSON.stringify (record));
    if (query.updateRecord ('CMS_content', { 'id': id }, record)) {
        var result = query.fetch (q)[0];
        sendNotification (proc, 'updatedContent', [{
            id: id,
            cover: cover,
            header: header,
            subheader: subheader,
            summary: summary,
            content: content,
            term: term,
            seq: result.seq
        }]);
        if (categoryChanged) {
            sendNotification (proc, 'refreshCategoryArticles', [term]); // TODO 'refreshCategoryArticles' to 'termChanged'
            sendNotification (proc, 'refreshCategoryArticles', [origTerm]); // TODO
        }
        return [true, {term: result.term, published_date: result.published_date }];
    } else
        return [false, query.lastError];
}

function notification (proc, enable)
{
    if (enable)
        JS.addProc (proc);
    else
        JS.removeProc (proc);
}

function login (proc, usr, pwd, nick)
{
    var logined = false;
    if (usr === 'guest') {
        proc.setPrivateData (JS, "usr", lastGuestID);
        if (!nick)
            nick = "guest" + lastGuestID;
        proc.setPrivateData (JS, "nick", nick);
        lastGuestID--;
        logined = true;
    } else {
        var result = query.fetch ('SELECT pwd,id FROM CMS_author WHERE name="' + usr + '"');
        if (result.length > 0 && result [0].pwd === pwd) {
            proc.setPrivateData (JS, "usr", result[0].id);
            logined = true;
        }
    }

    sendNotification (proc, 'logined', [logined]);

    return logined;
}

function logout (proc)
{
    proc.setPrivateData (JS, 'usr', undefined);
}

function getContents (proc, pro)
{
//     JS.mutexLock ()
    var q = '';

    // 条件
    var w = '';
    if (pro.term) {
        w += ' a.term="';
        w += pro.term + '"';
    }
    if (pro.cond && pro.cond.length > 0) {
        if (w.length > 0)
            w += ' AND ';
        w += pro.cond;
    }

    if (pro.list === 'true') {
        q = 'SELECT a.id,a.header,a.subheader,a.term,a.published_date,a.seq,a.author,a.cover,IFNULL(b.nick,a.guest_nick) AS nick';
    } else if (pro.index) {
        q = 'SELECT a.id,a.header,a.term';
    } else if (pro.summary === 'true')
        q = 'SELECT a.id,a.header,a.subheader,a.summary,a.term,a.published_date,a.seq,a.author,a.cover,IFNULL(b.nick,a.guest_nick) AS nick';
    else
        q = 'SELECT a.id,a.header,a.subheader,a.summary,a.content,a.term,a.published_date,a.seq,a.author,a.cover,IFNULL(b.nick,a.guest_nick) AS nick';
    q += ' FROM CMS_content AS a LEFT JOIN CMS_author AS b ON a.author=b.id';
    if (w.length > 0) {
        q += ' WHERE ';
        q += w;
    }

    // 排序
    if (pro.orderBy) {
        q += ' ORDER BY ';
        q += pro.orderBy;
    }

    // limit
    if (pro._limit) {
        q += ' LIMIT ';
        q += pro._limit;
    }

    jsDebug (q);
    var result = query.fetch (q);
    var ok = true;
    if (result.length === 0)
        ok = false;
//     JS.mutexUnlock()

    return [ok, result];
}

function changeSeq (proc, id, term, seq)
{
//    var q = 'UPDATE CMS_content SET seq=seq+1 WHERE term="' + term + '" AND seq>=' + seq
//    jsDebug (q)
//    query.exec (q)

//    q = 'UPDATE CMS_content SET seq=' + seq + ' WHERE id=' + id
//    jsDebug (q)
//    query.exec (q)

    query.exec ('BEGIN TRANSACTION;');

    query.exec ('UPDATE CMS_content SET seq=seq+1 WHERE term="' + term + '" AND seq>=' + seq);
    query.exec ('UPDATE CMS_content SET seq=' + seq + ' WHERE id=' + id);

    console.log ('UPDATE CMS_content SET seq=seq+1 WHERE term="' + term + '" AND seq>=' + seq);
    console.log ('UPDATE CMS_content SET seq=' + seq + ' WHERE id=' + id);
    // query.exec ('CREATE TEMPORARY TABLE ccs AS SELECT id,term,(SELECT COUNT(*) FROM CMS_content AS a WHERE a.seq <= CMS_content.seq AND a.term="' + term + '") AS seq FROM CMS_content WHERE CMS_content.term="' + term + '";')
    // query.exec ('UPDATE CMS_content SET seq=(SELECT seq FROM ccs WHERE ccs.id=CMS_content.id) WHERE CMS_content.term="' + term +'";')
    // query.exec ('DROP TABLE ccs;')
    reSeq (term, false);

    if (query.exec ('COMMIT;')) {
        sendNotification (proc, 'refreshCategoryArticles', [term]);
        q = 'SELECT seq FROM CMS_content WHERE id=' + id;
        var result = query.fetch (q) [0];
        return [true, result.seq];
    } else {
        jsDebug (query.lastError);
        return [false, query.lastError];
    }
}
