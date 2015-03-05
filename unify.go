package unify

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/influx6/evroll"
	"github.com/influx6/goutils"
	"log"
	"net/http"
	"net/url"
	"strings"
)

var WebSocketUpgrade = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type JSONReply struct {
	Upgrades []string
	Payload  interface{}
}

type RequestGlass interface {
	Write(data interface{})
	End()
	GetMeta() map[string]interface{}
	Reader() *evroll.Streams
	Writer() *evroll.Streams
	IsStream() bool
	Init()
}

type RequestMirror struct {
	res       http.ResponseWriter
	req       *http.Request
	Meta      map[string]interface{}
	InStream  *evroll.Streams
	OutStream *evroll.Streams
	Streamer  bool
}

type WebSocketMirror struct {
	*RequestMirror
	Procotol map[string]bool
	Upgrade  interface{}
}

type XHRMirror struct {
	*RequestMirror
	Procotol map[string]bool
}

type JsonMirror struct {
	*RequestMirror
	CallbackName string
	Procotol     map[string]bool
}

type Unified struct {
	Protocols map[string]bool
	Meta      map[string]interface{}
	Glass     RequestGlass
}

type RequestData struct {
	Form     interface{}
	PostForm interface{}
}

func (r *RequestMirror) GetMeta() map[string]interface{} {
	return r.Meta
}

func (r *RequestMirror) IsStream() bool {
	return r.Streamer
}

func (r *RequestMirror) Reader() *evroll.Streams {
	return r.InStream
}

func (r *RequestMirror) Writer() *evroll.Streams {
	return r.OutStream
}

func (r *Unified) IsStream() bool {
	return r.Glass.IsStream()
}

func (r *Unified) Init() {

}

func (r *Unified) Write(w interface{}) {
	r.Glass.Write(w)
}

func (r *Unified) End() {
	r.Glass.End()
}

type Unify struct {
	Activator func(u *Unified)
	Meta      map[string]interface{}
	Protocols map[string]bool
}

func (r *JsonMirror) Init() {}

func (r *JsonMirror) Write(data interface{}) {
	r.OutStream.Send(data)
}

func (r *JsonMirror) End() {
	reply := new(JSONReply)
	proc := []string{}

	for key, _ := range r.Procotol {
		if key != "jsonp" {
			proc = append(proc, key)
		}
	}

	reply.Upgrades = proc

	data, ok := r.OutStream.Buffer.Obj().([]interface{})

	if !ok {
		reply.Payload = data
	} else {
		if len(data) == 1 {
			reply.Payload = data[0]
		} else {
			reply.Payload = data
		}
	}

	r.OutStream.Buffer.Clear()

	buff, err := json.Marshal(reply)

	if err != nil {
		return
	}

	begin := []byte(";" + r.CallbackName + "(")
	end := []byte(");\n")
	buffer := []byte{}

	buffer = append(buffer, begin...)
	buffer = append(buffer, buff...)
	buffer = append(buffer, end...)
	size := len(buffer)

	r.res.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	r.res.Header().Set("Content-Length", fmt.Sprint(size))
	r.res.WriteHeader(200)
	r.res.Write(buffer)
}

func (r *XHRMirror) Init() {
	agent, ok := r.req.Header["User-Agent"]

	if ok {
		ag := strings.Join(agent, ";")
		msie := strings.Index(ag, ";MSIE")
		trident := strings.Index(ag, "Trident/")

		if msie != -1 || trident != -1 {
			r.res.Header().Set("X-XSS-Protection", "0")
		}
	}

	origin, ok := r.req.Header["Origin"]

	if ok {
		r.res.Header().Set("Access-Control-Allow-Credentials", "true")
		r.res.Header().Set("Access-Control-Allow-Origin", strings.Join(origin, ";"))
	} else {
		r.res.Header().Set("Access-Control-Allow-Origin", "*")
	}

	content, ok := r.req.Header["Content-Type"]
	muxcontent := strings.Join(content, ";")
	wind := strings.Index(muxcontent, "application/x-www-form-urlencode")
	mind := strings.Index(muxcontent, "multipart/form-data")

	if ok {

		if wind != -1 {
			if err := r.req.ParseForm(); err != nil {
				log.Println(err)
			} else {
				r.InStream.Send(&RequestData{r.req.Form, r.req.PostForm})
			}
		}

		if mind != -1 {
			if err := r.req.ParseMultipartForm(32 << 20); err != nil {
				log.Println(err)
			} else {
				r.InStream.Send(&RequestData{r.req.MultipartForm.Value, r.req.MultipartForm.File})
			}
		}
	}
}

func (r *XHRMirror) End() {
	proc := []string{}

	for key, _ := range r.Procotol {
		if key != "jsonp" {
			proc = append(proc, key)
		}
	}

	buffer := []byte{}

	r.Writer().Receive(func(d interface{}) {
		bits := goutils.MorphByte.Morph(d)
		buffer = append(buffer, bits...)
	})
	r.Writer().Stream()

	// r.res.Header().Set("Content-Type", "charset=utf-8")
	r.res.Header().Set("Content-Length", fmt.Sprint(len(buffer)))
	r.res.WriteHeader(200)
	r.res.Write(buffer)
}

func (r *XHRMirror) Write(data interface{}) {
	r.OutStream.Send(data)
}

func (r *WebSocketMirror) End() {

}

func (r *WebSocketMirror) Init() {
	agent, ok := r.req.Header["User-Agent"]

	if ok {
		ag := strings.Join(agent, ";")
		msie := strings.Index(ag, ";MSIE")
		trident := strings.Index(ag, "Trident/")

		if msie != -1 || trident != -1 {
			r.res.Header().Set("X-XSS-Protection", "0")
		}
	}

	origin, ok := r.req.Header["Origin"]

	if ok {
		r.res.Header().Set("Access-Control-Allow-Credentials", "true")
		r.res.Header().Set("Access-Control-Allow-Origin", strings.Join(origin, ";"))
	} else {
		r.res.Header().Set("Access-Control-Allow-Origin", "*")
	}

	u, err := WebSocketUpgrade.Upgrade(r.res, r.req, nil)

	if err != nil {
		log.Println(err)
		return
	}

	r.Upgrade = u
}

func (r *WebSocketMirror) Write(data interface{}) {
	//convert to byte[] array
	buffer, ok := data.([]byte)

	if !ok {
		return
	}

	var _ interface{}
	_ = buffer
}

func IsWebSocketRequest(r *http.Request) bool {
	var _ interface{}
	_, has_upgrade := r.Header["Upgrade"]
	_, has_sec := r.Header["Sec-Websocket-Version"]
	_, has_ext := r.Header["Sec-Websocket-Extensions"]
	_, has_key := r.Header["Sec-Websocket-Key"]
	return has_upgrade && has_sec && has_ext && has_key
}

func CreateTransport(rw http.ResponseWriter, r *http.Request, u *Unify) RequestGlass {
	reqmirror := &RequestMirror{rw, r, make(map[string]interface{}), evroll.NewStream(false), evroll.NewStream(false), false}
	query, _ := url.ParseQuery(r.URL.RawQuery)
	cbName := "callback"

	if IsWebSocketRequest(r) {
		if proc, ok := u.Meta["Protocols"].(map[string]interface{}); ok {
			if isoc, ok := proc["websocket"].(bool); ok {
				if !isoc {
					return nil
				}
			}
		}
		reqmirror.Streamer = true
		return RequestGlass(&WebSocketMirror{reqmirror, u.Protocols, nil})
	}

	if _, ok := query["json"]; ok {
		if proc, ok := u.Meta["Protocols"].(map[string]interface{}); ok {
			if isoc, ok := proc["jsonp"].(bool); ok {
				if !isoc {
					return nil
				}
			}
		}
		jscall, okc := query[cbName]
		if okc {
			reqmirror.Streamer = false
			return RequestGlass(&JsonMirror{reqmirror, jscall[0], u.Protocols})
		}
	}

	reqmirror.Streamer = true
	return RequestGlass(&XHRMirror{reqmirror, u.Protocols})
}

func (u *Unify) Serve(rw http.ResponseWriter, r *http.Request) {
	glass := CreateTransport(rw, r, u)
	ui := &Unified{u.Protocols, make(map[string]interface{}), glass}
	glass.Init()
	u.Activator(ui)
}

func (u *Unify) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	u.Serve(rw, r)
	rw.Header().Set("Content-Type", "text/plain")
	rw.Write([]byte("welcome!"))
}

func CreateUnify(f func(con *Unified), protocols []string) *Unify {
	proc := make(map[string]bool)
	u := &Unify{f, make(map[string]interface{}), proc}

	for _, v := range protocols {
		proc[v] = true
	}

	if _, ok := proc["xhr"]; !ok {
		proc["xhr"] = true
	}

	return u
}
