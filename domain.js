var _ = require("stackq");

var domain = module.exports = {};

domain.Requests = _.Checker({
  fn: _.valids.Function,
  path: _.valids.String,
  //includes the not required but standard pieces
  scheme: _.funcs.maybe(_.valids.String),
  headers: _.funcs.maybe(_.valids.Object),
  binary: _.funcs.maybe(_.valids.Boolean),
  port: _.funcs.maybe(_.valids.String),
  type: _.funcs.maybe(_.valids.String),
  host: _.funcs.maybe(_.valids.String),
  method: _.funcs.maybe(_.valids.String),
  async: _.funcs.maybe(_.valids.Boolean),
  socket: _.funcs.maybe(_.valids.Boolean),
});
