/* Bản mobile (chạy tĩnh, không cần máy chủ): thay thế các lời gọi /api/... của giao diện
 * bằng tính toán ngay trên điện thoại. Dữ liệu các kỳ quay lấy từ file JSON trong thư mục data/. */
(function ($) {
  'use strict';
  var VL = window.VL;
  var gamesInfo = null, cross = null, sig = '', gamesP = null;
  var rowsByGame = {}, memo = {};

  function fetchJson(name) {
    return fetch('data/' + name + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); } // cùng dạng dữ liệu như máy chủ trả về
  function reject(status, msg) {
    var d = $.Deferred();
    d.reject({ status: status, responseJSON: { error: msg } });
    return d.promise();
  }
  function httpError(status, msg) { return Object.assign(new Error(msg), { status: status }); }

  // Tải danh sách loại + tóm tắt; nếu có kỳ mới thì bỏ bộ nhớ đệm để tải lại dữ liệu từng loại.
  function loadGames() {
    return fetchJson('games.json').then(function (g) {
      var s = g.version + '|' + g.games.map(function (x) { return x.latestNo + ':' + x.draws; }).join(',');
      if (s !== sig) { sig = s; rowsByGame = {}; memo = {}; }
      gamesInfo = g.games;
      cross = g.cross || null;
      return gamesInfo;
    });
  }
  function games(force) {
    if (force || !gamesP) {
      gamesP = loadGames().catch(function (e) {
        if (gamesInfo) return gamesInfo; // mất mạng: dùng dữ liệu đã tải
        gamesP = null;
        throw e;
      });
    }
    return gamesP;
  }
  function rows(code) {
    if (rowsByGame[code]) return Promise.resolve(rowsByGame[code]);
    return fetchJson(code + '.json').then(function (r) { rowsByGame[code] = r; return r; });
  }

  function getGame(q) {
    var code = q.get('game') || '655';
    if (!VL.GAMES[code]) throw httpError(400, 'game không hợp lệ: ' + code);
    return code;
  }
  function intParam(q, name, def, min, max) {
    var v = parseInt(q.get(name), 10);
    return isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  }
  function light(all) { return all.map(function (r) { return { no: r.no, date: r.date, main: r.main, bonus: r.bonus }; }); }
  function analysis(code, last, all) {
    var key = code + '|' + last + '|' + all.length;
    if (!memo[key]) memo[key] = VL.S.analyze(light(all), VL.GAMES[code], { last: last });
    return memo[key];
  }

  var ROUTES = {
    '/api/stats': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000);
      return rows(code).then(function (all) { return analysis(code, last, all); });
    },
    '/api/draws': function (q) {
      var code = getGame(q), limit = intParam(q, 'limit', 30, 1, 500);
      return rows(code).then(function (all) { return all.slice(-limit).reverse(); });
    },
    '/api/check': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000), game = VL.GAMES[code];
      var ticket = VL.T.parseTicket(code, game, q.get('numbers'), q.get('special'));
      return rows(code).then(function (all) {
        var res = VL.T.checkTicket(code, game, last > 0 ? all.slice(-last) : all, ticket);
        var info = new Map(analysis(code, last, all).numbers.map(function (n) { return [n.n, n]; }));
        res.numbers = ticket.numbers.map(function (n) { return info.get(n); });
        return res;
      });
    },
    '/api/suggest': function (q) {
      var code = getGame(q), last = intParam(q, 'last', 0, 0, 100000);
      var mode = ['uniform', 'hot', 'cold', 'rare'].indexOf(q.get('mode')) >= 0 ? q.get('mode') : 'uniform';
      return rows(code).then(function (all) {
        var d = light(all);
        return VL.S.suggest(last > 0 ? d.slice(-last) : d, VL.GAMES[code], mode, intParam(q, 'count', 5, 1, 20));
      });
    },
    '/api/crosscheck': function () { return cross || { none: true }; }
  };

  function handle(opts) {
    var u = new URL(opts.url, location.href), q = u.searchParams;
    var method = String(opts.method || opts.type || 'GET').toUpperCase();
    var path = '/api/' + u.pathname.split('/api/').pop();
    var d = $.Deferred();
    var done = function (v) { d.resolve(clone(v)); };
    var bad = function (e) { d.reject({ status: e.status || 500, responseJSON: { error: e.message || String(e) } }); };

    setTimeout(function () {
      try {
        if (path === '/api/games' && method === 'GET') {
          games(true).then(done, function () { bad(httpError(0, 'Không tải được dữ liệu.')); });
        } else if (path === '/api/update' && method === 'POST') {
          var before = {};
          (gamesInfo || []).forEach(function (g) { before[g.code] = g.draws; });
          games(true).then(function (list) {
            var out = {};
            list.forEach(function (g) { out[g.code] = { fetched: Math.max(0, g.draws - (before[g.code] || g.draws)) }; });
            done({ ok: true, result: out, log: [] });
          }, function () { bad(httpError(0, 'không tải được dữ liệu mới, hãy kiểm tra mạng.')); });
        } else if (path === '/api/crosscheck' && method === 'POST') {
          games(true).then(function () {
            if (cross) done(cross); else bad(httpError(400, 'Đối chiếu nguồn chỉ chạy được trên máy tính.'));
          }, function () { bad(httpError(0, 'không tải được dữ liệu.')); });
        } else if (method === 'GET' && ROUTES[path]) {
          games(false).then(function () {
            return new Promise(function (ok) { setTimeout(ok, 15); }).then(function () { return ROUTES[path](q); });
          }).then(done, function (e) { bad(e && e.status ? e : httpError(e && e.status === 0 ? 0 : 500, (e && e.message) || 'Lỗi')); });
        } else {
          bad(httpError(404, 'Không có API này'));
        }
      } catch (e) { bad(e); }
    }, 0);
    return d.promise();
  }

  var realAjax = $.ajax;
  $.ajax = function (url, settings) {
    var opts = typeof url === 'string' ? $.extend({ url: url }, settings || {}) : url;
    if (opts && /(^|\/)api\//.test(String(opts.url).split('?')[0])) return handle(opts);
    return realAjax.apply(this, arguments);
  };
})(jQuery);
