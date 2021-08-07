import * as moment from "moment";

export function formatTimeAgo(time, base = Date.now(), simple = false) {
  time = new Date(time);
  const passSecs = parseInt((base - time) / 1e3, 10);
  if (passSecs < 1)
      return "0 sec ago";
  if (passSecs < 60)
      return "".concat(passSecs, " ").concat(1 === passSecs ? "sec" : "secs", " ago");
  if (passSecs < 3600) {
      const mins = Math.floor(passSecs / 60);
      return "".concat(mins, " ").concat(1 === mins ? "min" : "mins", " ago")
  }
  if (passSecs < 86400) {
      const hours = Math.floor(passSecs / 3600);
      const mins = Math.floor(passSecs / 60 % 60);
      return simple ? "".concat(hours, " ").concat(1 === hours ? "hr" : "hrs", " ago") : "".concat(hours, " ").concat(1 === hours ? "hr" : "hrs").concat(0 === mins ? "" : 1 == mins ? " 1 min" : " ".concat(mins, " mins"), " ago")
  }
  if (passSecs < 9e4) {
      const days = Math.floor(passSecs / 86400);
      const hours = Math.floor(passSecs / 60 % 60);
      return simple ? "".concat(days, " ").concat(1 === days ? "day" : "days", " ago") : "".concat(days, " ").concat(1 === days ? "day" : "days").concat(0 === hours ? "" : 1 == hours ? " 1 min" : " ".concat(hours, " mins"), " ago")
  }
  const days = Math.floor(passSecs / 86400)
  const hours = Math.floor(passSecs / 60 / 60 % 24);
  return simple ? "".concat(days, " ").concat(1 === days ? "day" : "days", " ago") : "".concat(days, " ").concat(1 === days ? "day" : "days").concat(0 === hours ? "" : 1 == hours ? " 1 hr" : " ".concat(hours, " hrs"), " ago")
}

export function formatTimeUtc(time) {
  return new Date(time).toISOString().replace(/T/, ' ').slice(0, -5) + " (+UTC)";
}

export function ecllipseHash(hash) {
  if (hash <= 16) return hash;
  return hash.slice(0, 7) + "...." + hash.slice(-5);
}

export function formatNum(num) {
  return num.toString().replace(/(\d)(?=(?:\d{3})+$)/g,'$1,');
}

export function formatNumIdx(numIdx) {
  const [num, idx] = numIdx.split("-");
  return formatNum(num) + "-" + idx;
}

export function parseQueryForm(query) {
  let module = [];
  let date = [];
  if (query.section) {
    module.push(query.section);
    if (query.method) {
      module.push(query.method);
    }
  }
  if (query.startDate && query.endDate) {
    const startDate = parseInt(query.startDate);
    const endDate = parseInt(query.endDate);
    if (startDate && endDate) {
      date = [moment(startDate * 1000), moment(endDate * 1000)];
    }
  }
  return { module, date };
}

export function stringifyQueryForm(qs, queryForm) {
  if (queryForm.module?.length) {
    qs += `&section=${queryForm.module[0]}`;
    if (queryForm.module[1]) {
      qs += `&method=${queryForm.module[1]}`;
    }
  }
  if (queryForm.date?.length) {
    qs += `&startDate=${Math.floor(queryForm.date[0].toDate().getTime() / 1000)}`;
    qs += `&endDate=${Math.ceil(queryForm.date[1].toDate().getTime() / 1000)}`;
  }
  return qs;
}