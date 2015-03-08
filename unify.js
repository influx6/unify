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
        socket: false,
        credentials: true,
    };

    var createXDR = function(){
        if(typeof global.XDomainRequest === "undefined" && typeof XDomainRequest === "undefined"){
            return createXHR();
        }
        return function(){
            var xdr = new XDomainRequest();
            return xdr;
        };
    };

    var isXDR = function(o){
        if(typeof global.XDomainRequest === "undefined" && typeof XDomainRequest === "undefined"){
            return false;
        }
        return o instanceof XDomainRequest;
    };

    var isIOS = function(){
        if("undefined" != typeof global.navigator && /iPad|iPhone|iPod/i.test(global.navigator.userAgent)){
            return true;
        }
        return false;
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

            this.pub("error");
            this.pub("request");
            this.pub("done");

            this.connection = null;
            this.buffer = [];
            this.heartBeat = 1000;
            this.upgraded = upgradable;

            this.hooks = _.MiddlewareHooks.make("transport-hooks");

            if(map.socket){
                this.scheme = map.ssl ? "wss" : "ws";
            }else{
                this.scheme = map.ssl ? "https" : "http";
            }

            this.port = (_.valids.not.contains(map,"port") ? (map.ssl ? 443 : (global.location.port ? global.location.port : 80)) : (new String(map.port).replace(/^:/,"").toString()));
            this.host = (_.valids.not.contains(map,"host") ? global.location.hostname : map.host);
            this.binary = (_.valids.not.contains(map,"binary") ? false : true);
            this.binaryType = (_.valids.not.contains(map,"binary") ? "application/octect-stream": "text/plain;charset=utf-8");
            this.basetype = (_.valids.not.contains(map,"type") ? "x-www-form-urlencoded" : map.type);
            this.async = (_.valids.not.contains(map,"async") ? true : map.async);
            this.active = false;

            this.method = this.$bind(function(){
                hasbuff = this.buffer.length > 0;
                return _.valids.not.contains(this.map,"method") ? (hasbuff ? "POST" : "GET") : this.map.method;
            });

            this.$unsecure("makeURL",function(){
                var q = this.getConfigAttr("query");
                var qs = _.valids.exists(q) ? ( "?" + q) : "";
                var uri = (this.scheme + "://" + this.host +  ":" + this.port + "/" + this.map.path.replace(/^\//,"") + qs);
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

            this.after("done",function(o){
                self.connection = null;
                self.active = false;
            });

            this.hooks.addBefore(function(d,next,end){
                self.connection = d;
                self.active = true;
                self.emit("request",d);
                next();
            });

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

            //ensure to deal with memory leaks
            if(global.attachEvent){
                global.attachEvent("onunload",self.$bind(self.disconnect));
            }else if(global.addEventListener){
                global.addEventListener("beforeunload",self.$bind(self.disconnect));
            }

        },
        Headers: function(map){
          this.headers.addAll(map);
        },
        write: function(data){
            this.buffer.push(data);
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
                this.emit("done",this.connection);
            });

            this.$secure("handleError",function(script,err){
                this.emit("error",script,err);
                script.onload = script.onerror = null;
            });

            this.hooks.addBefore(function(o,next,end){
                o.onerror = function(e){
                    self.handleError(o,e);
                };
                next();
            });

            this.hooks.addBefore(function(o,next,end){
                var heads = [];
                this.headers.each(function(e,i,o,fx){
                    heads.push([i,e].join("="));
                });

                var prehead = this.getConfigAttr("prehead");
                heads = heads.concat(prehead);

                this.config({
                    query: heads.join("&")
                });

                next();
            });

            this.hooks.add(function(o,next,end){
                o.src = this.makeURL();
                doc.body.appendChild(o);
                next();
            });
      },
      connect: function(){
        if(this.active) return;
        if(_.valids.not.Function(win[this.__cbName])){
         win[this.__cbName] = function(){
          var args = _.enums.toArray(arguments);
          self.handleReply.apply(self,args);
         };
        }
        this.hooks.emitWith(this,doc.createElement("script"));
      },
      disconnect: function(){
         doc.body.removeChild(this.connection);
         delete win[this.__cbName];
      },
      toJSONP: function(){
         return this;
      },
    });

    this.XHRTransport = this.Transport.extends({
        init: function(map,t){
            this.$super(map,t);
            var self = this;

            if(this.cors && this.xdr){
              this.generator = createXDR();
            }else{
             this.generator = createXHR();
            }

            this.$secure("handleReply",function(o){
                var data,ctype,upgrades;
                try{
                    try{
                        ctype = o.getResponseHeader("Content-Type").split(/;/)[0];
                        upgrades = o.getResponseHeader("Upgrades").split(/;/);
                    }catch(e){}

                    if(ctype === "application/octect-stream"){
                        data  = o.response;
                    }else{
                        if(!this.binary){
                          data = o.responseText;
                        }else{
                          data = o.response;
                        }
                    }
                }catch(e){
                    this.emit("error",o,e);
                }

                this.__update(upgrades);
                map.fn.call(null,data);
                this.emit("done",data);
            });

            this.$secure("handleError",function(o,err){
                this.emit("error",script,err);
                o.onreadystatechange = o.onload = o.onerror = null;
            });

            this.hooks.add(function(o,next,end){
                o.onerror = function(e){
                    self.handleError(o,e);
                };
                next();
            });

            this.hooks.add(function(o,next,end){
                if (this.map.credentials){
                    o.withCredentials = true;
                }

                if (isXDR(o)){
                    o.onError = function(e){
                        self.handleError(o,e);
                    };

                    o.onLoad = function(){
                        self.handleReply(o);
                    };
                }else{
                    o.onreadystatechange = function(){
                        if(4 != o.readyState) return;
                        if(200 == o.status || 1223 == o.status){
                            self.handleReply(o);
                        }else{
                            setTimeout(function(){
                                self.handleError(o,self.status);
                            },0);
                        }
                    };
                }

                next();
            });

            this.hooks.addBefore(function(o,next,end){
                var url = this.makeURL();
                o.open(this.method(),url,this.async);
                if(this.binary){
                    o.responseType = "arraybuffer";
                }
                next();
            });

            this.hooks.addBefore(function(o,next,end){
                this.headers.each(function(e,i,o,fx){
                    o.setRequestHeader(i,e);
                });
                next();
            });

            this.hooks.addAfter(function(o,next,end){
                var data = this.buffer.length == 1 ? this.buffer[0] : this.buffer;
                this.buffer = [];
                console.log("sending:",data)
                o.send(data);
                next();
            });

        },
        connect: function(){
            if(this.active) return;
            var req = this.generator();
            this.connection = req;
            this.hooks.emitWith(this,req);
        },
        disconnect: function(){
          if(this.active){
              this.connection.abort();
          }
        },
    });

    this.WebSocketTransport = this.Transport.extends({
        init: function(map,t){
            map.socket = true;
            this.$super(map,t);
            var self = this;

            this.pub("flush");
            this.pub("drain");

            this.pub("open");
            this.pub("close");
            this.pub("reply");

            this.$secure("flushBuffer",function(){
                if(this.buffer.length <= 0){
                  this.emit("drain",this.connection);
                }else{

                  this.emit("flush",this.connection);
                }
            });

            this.$secure("handleReply",function(ev){
                if(isIOS()){
                  _.Util.nextTick(function(){
                     map.fn.call(null,ev.data,ev);
                  });
                }else{
                 map.fn.call(null,ev.data,ev);
                }
                this.emit("reply",ev);
            });

            this.$secure("handleOpen",function(e){
                this.emit("open",e);
            });

            this.$secure("handleError",function(e){
                this.emit("error",e);
            });

            this.$secure("handleClose",function(e){
                this.emit("close",e);
            });

            this.hooks.add(function(d,next,end){
                console.log("in:",d);
                next();
            });

            this.hooks.addBefore(function(d,next,end){
                console.log("before:",d);
                d.binaryType = "arraybuffer";
                d.onmessage = function(ev){
                  self.handleReply(ev);
                };
                d.onerror = function(e){
                  self.handleError(e);
                };
                d.onopen = function(){
                  self.handleOpen(d);
                };
                d.onclose = function(){
                  self.handleClose(d);
                };
                next();
            });

            this.hooks.addAfter(function(d,next,end){
                console.log("after:",d);
                next();
            });

        },
        connect: function(){
         if(this.active){
            return this.flush();
         }
          var url = this.makeURL();
          var ws = new WebSocket(url);
          this.connection = ws;
          this.hooks.emitWith(this,ws);
        },
        disconnect: function(){
          if(this.active){
              this.connection.close();
          }
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
