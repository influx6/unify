var _ = require("stackq");

var domain = module.exports = {};

domain.Requests = _.Checker({
  url: _.valids.String,
  fn: _.valids.Function,
})
