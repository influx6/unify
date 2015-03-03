var _ = require("stackq");
var domain = require("./domain.js");
var win = global.window;
var doc = win.document;


var unify = _.Mask(function(){

    var uni = this, cbhash = 0x4ffa;
    var xhrgen;

    var createJSON = function(map){
        domain.Requests.is(map,function(state,report){
            _.Asserted(state,"invalid map for connection: "+report);
        });

        var uri,cb,qs,script = doc.createElement("script");

        if (qs){
            qs = _.enums.map(map.headers,function(e,i,o){
                return [i,e].join("=");
            });
        }

        rn = Math.floor(1 * Math.random(10));
        sb = ["Callback",cbhash+=rn].join("");
        cb = ["callback","=",sb].join("")
        uri = [map.url,'?',qs,"&json=true&",cb];

        script.src = uri.join("");
        return {
          script: script,
          name: sb,
          fn: map.fn
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
            domain.Requests.is(map,function(state,report){
                _.Asserted(state,_.Util.String(" ","invalid config properties for connection","\n",report));
            });

            if(upgradable){
                uni.isTransport.is(upgradable,function(state,report){
                    _.Asserted(state,"not a valid transport class");
                });
            }

            this.upgradedFrom = upgradable;
            this.$super();
            this.heartBeat = 1000;
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
        connect: function(){},
        disconnect: function(){},
        toXHR: function(map){
          if(!this.xhr.isOn()) return;
          map = _.Util.extends({},this.map,map);
          return uni.XHR.make(map,this);
        },
        toWebSocket: function(){
          if(!this.socket.isOn()) return;
          map = _.Util.extends({},this.map,map);
          return uni.WebSocket.make(map,this);
        },
        toJSON: function(){
          if(!this.json.isOn()) return;
          map = _.Util.extends({},this.map,map);
          return uni.JSON.make(map,this);
        },
    });

    this.JSON = this.Transport.extends({
      init: function(map,t){
        this.$super(map,t);

        this.$secure("handleReply",function(data){
            console.log("got reply:",data);
            var upgrades = data.Upgrades,
                payload = data.Payload;

            var fn = this.getConfigAttr("fn");

            this.__update(upgrades);
            fn.call(null,payload);
        });

        var jsonConf = this.connector = createJSON(this.map);
        this.config(jsonConf);

        var self = this;
        win[jsonConf.name] = function(){
          var args = _.enums.toArray(arguments);
          self.handleReply.apply(self,args);
        };
        },
        connect: function(){
        doc.body.appendChild(this.connector.script);
        },
        disconnect: function(){
        doc.body.removeChild(this.connector.script);
        delete win[this.getConfigAttr("name")]
        },
        toJSONP: function(){
        return this;
        },
    });

    this.XHR = this.Transport.extends({
        init: function(map,t){
            this.$super(map,t);
        },
        connect: function(){

        },
        disconnect: function(){

        },
    });

    this.WebSocket = this.Transport.extends({
        init: function(map,t){
        this.$super(map,t);
        },
        connect: function(){

        },
        disconnect: function(){

        }
    });


    this.isTransport = _.Checker.Type(this.Transport.instanceBelongs);
});

module.exports = unify;
global.Unify = unify;
