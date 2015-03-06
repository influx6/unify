var _ = require("stackq");
var domain = require("./domain.js");
var win = global.window;
var doc = win.document;



var unify = _.Mask(function(){

    var uni = this, cbhash = 0x4ffa;
    var xhrgen;

    var XHRMap = {
        cors: false,
        xdr: false,
        ssl: false,
        credentails: true,
    };

    var createXDR = function(){
        if(typeof global.XDomainRequest === "undefined" && typeof XDomainRequest === "undefined"){
            return createXHR();
        }
        return function(){
            return new XDomainRequest();
        };
    };

    var createXHR = function(){
        if(xhrgen) return xhrgen;

        xhrgen = (function(){
            if(_.valids.contains(global,"XMLHttpRequest")){
                return function(){
                    return new XMLHttpRequest();
                };
            }

            var lists = ["MSXML2.XMLHTTP.3.0","MSXML2.XMLHTTP","Microsoft.XMLHTTP"], fnx;

            _.enums.filter(lsits,function(e,i,o){
                try{
                  var x = new ActiveXObject(e);
                }
                catch(e){
                  return;
                }
                return e;
            });

            return function(){
                xml = _.enums.first(lists);
                return new ActiveXObject(xml);
            };
        }());
        return xhrgen;
    };

    this.Connection = _.Configurable.extends({
        init: function(){
            this.$super()
        },
    });

    this.Transport = _.Configurable.extends({
        init: function(map,upgradable){
            map = _.Util.extends({},XHRMap,map);
            domain.Requests.is(map,function(state,report){
                _.Asserted(state,_.Util.String(" ","invalid config properties for connection","\n",report));
            });

            if(upgradable){
                uni.isTransport.is(upgradable,function(state,report){
                    _.Asserted(state,"not a valid transport class");
                });
            }

            var self = this;
            this.$super();

            this.heartBeat = 1000;
            this.upgraded = upgradable;

            this.hooks = _.Hooks.make("transport-hooks");
            this.scheme = map.ssl ? "https" : "http";
            this.port = (_.valids.not.contains(map,"port") ? (map.ssl ? 443 : (global.location.port ? global.location.port : 80)) : map.port);
            this.host = (_.valids.not.contains(map,"host") ? global.location.hostname : map.host);
            this.binary = (_.valids.not.contains(map,"binary") ? "application/octect-stream": "text/plain;charset=utf-8");
            this.basetype = (_.valids.not.contains(map,"type") ? "x-www-form-urlencoded" : map.type);

            this.$unsecure("makeURL",function(){
                query = this.getConfigAttr("query");
                var uri = (this.scheme + "://" + this.host +  ":" + this.port + "/" + this.map.path + "?" + query);
                return uri;
            });

            this.headers = _.Store.make();
            this.map = map;

            //switches to allow connection to available upgrades
            this.json = _.Switch();
            this.xhr = _.Switch();
            this.socket = _.Switch();

            this.json.on();
            this.xhr.on();
            this.socket.on();

            this.$secure("__update",function(upgrades){
                upgrades = _.enums.map(upgrades,function(e){ return e.toLowerCase(); });

                this.upgrades = upgrades;

                if(upgrades.indexOf("xhr") !== -1) this.xhr.on();
                else this.xhr.off();

                if(upgrades.indexOf("jsonp") !== -1 && upgrades.indexOf("json") !== -1) this.json.on();
                else this.json.off();

                if(upgrades.indexOf("websocket") !== -1) this.socket.on();
                else this.socket.off();
            });
        },
        Headers: function(map){
          this.headers.addAll(map);
        },
        connect: function(){},
        disconnect: function(){},
        toXHR: function(map){
          if(!this.xhr.isOn()) return;
          map = _.Util.extends({},this.map,map);
          return uni.XHRTransport.make(map,this);
        },
        toWebSocket: function(){
          if(!this.socket.isOn()) return;
          map = _.Util.extends({},this.map,map);
          return uni.WebSocketTransport.make(map,this);
        },
        toJSON: function(){
          if(!this.json.isOn()) return;
          map = _.Util.extends({},this.map,map);
          return uni.JSONTransport.make(map,this);
        },
    });

    this.JSONTransport = this.Transport.extends({
      init: function(map,t){
            this.$super(map,t);

            var self = this;
            var rn = Math.floor(1 * Math.random(10));

            this.__cbName = ["__Callback",cbhash+=rn].join("");

            this.config({
               "prehead": ["json=true","callback="+this.__cbName]
            });

            win[this.__cbName] = function(){
              var args = _.enums.toArray(arguments);
              self.handleReply.apply(self,args);
            };

            this.$secure("handleReply",function(data){
                var upgrades = data.Upgrades,
                    payload = data.Payload;

                this.__update(upgrades);
                map.fn.call(null,payload);
            });

            this.hooks.addBefore(function(o){
                var heads = [];
                self.headers.each(function(e,i,o,fx){
                    heads.push([i,e].join("="));
                });

                var prehead = this.getConfigAttr("prehead");
                heads = heads.concat(prehead);

                this.config({
                    query: heads.join("&")
                });
            });


            this.hooks.add(function(o){
                o.src = this.makeURL();
                doc.body.appendChild(o);
            });

      },
      connect: function(){
            this.hooks.distributeWith(this,[doc.createElement("script")]);
      },
      disconnect: function(){
            doc.body.removeChild(this.connector.script);
            delete win[this.__cbName];
      },
      toJSONP: function(){
            return this;
      },
    });

    this.XHRTransport = this.Transport.extends({
        init: function(map,t){
            this.$super(map,t);

            if(this.cors && this.xdr){
              this.generator = createXDR();
            }else{
             this.generator = createXHR();
            }

            this.hooks.addBefore(function(o){
                console.log("before hook:",o);
            });

            this.hooks.add(function(o){
                console.log("in hook:",o);
            });

            this.hooks.addAfter(function(o){
                console.log("after hook:",o);
            });

            this.connections = [];
        },
        connect: function(){
            var req = this.generator();
            this.hooks.emit(req);
            this.connections.push(req);
        },
        disconnect: function(){

        },
    });

    this.WebSocketTransport = this.Transport.extends({
        init: function(map,t){
        this.$super(map,t);
        },
        connect: function(){

        },
        disconnect: function(){

        }
    });

    this.unsecure("JSON",function(map){
        return this.JSONTransport.make(map);
    });

    this.unsecure("Websocket",function(map){
        return this.WebSocketTransport.make(map);
    });

    this.unsecure("XHR",function(map){
        return this.XHRTransport.make(map);
    });

    this.isTransport = _.Checker.Type(this.Transport.instanceBelongs);
});

module.exports = unify;
global.Unify = unify;
