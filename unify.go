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

type Unify struct {
	Activator func(u *Unified)
	Meta      map[string]interface{}
	Protocols map[string]bool
}

type JSONReply struct {
	Upgrades []string
	Payload  interface{}
}

//MessagePack are the internal construt created when messages are recieved from any transport,in a sense its a means of unifying
//the data recieved on any transport although certain differences do occur,hence the message pack comes with a Type parameter
//that ranges from Form,File and Socket for the respective types.
//Form usually occurs for x-www-urlencoded-from data ,that is form data sent directly to the server
//File for octect-stream or file or binary data
//Socket for socket based messages,as we are using gorilla/websocket,we need to know the message type
//The head and Body paramters can really contain any data as needed
type MessagePack struct {
	Type string
	Head interface{}
	Body interface{}
	Bit  int
}

//RequestGlass is the general interface definition for all mirrors and defines a few functions that allow unified control
//despite the underline transport type
type RequestGlass interface {
	Write(data *MessagePack)
	End()
	GetMeta() map[string]interface{}
	Reader() *evroll.Streams
	Writer() *evroll.Streams
	IsStream() bool
	Init()
}

//Requestmirror handles the normal http request connections and wraps up the response and request objects for use
type RequestMirror struct {
	res       http.ResponseWriter
	req       *http.Request
	Meta      map[string]interface{}
	InStream  *evroll.Streams
	OutStream *evroll.Streams
	Streamer  bool
}

//WebSocketMirror handles wrapping of the websocket connection into a comforming glass interface and provides
//a basic protocol type and all input come as messagepack with socket as type
type WebSocketMirror struct {
	Type int
	*RequestMirror
	Procotol map[string]bool
	Socket   *websocket.Conn
}

type XHRMirror struct {
	Type int
	*RequestMirror
	Procotol map[string]bool
}

type JsonMirror struct {
	Type int
	*RequestMirror
	CallbackName string
	Procotol     map[string]bool
}

type Unified struct {
	Protocols map[string]bool
	Meta      map[string]interface{}
	Glass     RequestGlass
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

func (r *Unified) Reader() *evroll.Streams {
	return r.Glass.Reader()
}

func (r *Unified) Writer() *evroll.Streams {
	return r.Glass.Writer()
}

func (r *Unified) WriteString(w string) {
	m := &MessagePack{"Data", nil, w, 1}
	r.Write(m)
}

func (r *Unified) Write(w *MessagePack) {
	r.Glass.Write(w)
}

func (r *Unified) End() {
	r.Glass.End()
}

func (r *JsonMirror) Init() {
	q := r.req.URL.RawQuery
	fr := r.req.URL.Fragment
	qs, err := url.ParseQuery(q)

	if err != nil {
		log.Println("Raw Query Parsing Error:", err)
		return
	}

	// delete(qs, "json")
	// delete(qs, "callback")

	pack := &MessagePack{"Param", fr, qs, 0}

	r.Reader().Send(pack)
}

func (r *JsonMirror) Write(data *MessagePack) {
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

	brf := make([]interface{}, 0)

	r.Writer().Receive(func(d interface{}) {
		m, ok := d.(*MessagePack)

		if !ok {
			return
		}

		// bits := goutils.MorphByte.Morph(m.Body)
		brf = append(brf, m.Body)
	})

	r.Writer().Stream()

	if len(brf) == 1 {
		reply.Payload = brf[0]
	} else {
		reply.Payload = brf
	}

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
				log.Println("Request Read Form Error", err)
			} else {
				r.InStream.Send(&MessagePack{"Form", r.req.Form, r.req.PostForm, 1})
			}
		}

		if mind != -1 {
			if err := r.req.ParseMultipartForm(32 << 20); err != nil {
				log.Println("Request Read MultipartForm Error", err)
			} else {
				r.InStream.Send(&MessagePack{"File", r.req.MultipartForm.Value, r.req.MultipartForm.File, 1})
			}
		}

		if mind == -1 && wind == -1 && r.req.Body != nil {

			data := make([]byte, r.req.ContentLength)
			total, err := r.req.Body.Read(data)

			if err != nil {
				log.Println("Request Read Body Error", err)
			}

			r.InStream.Send(&MessagePack{"body", total, data, 2})
		}
	}
}

func (r *XHRMirror) End() {
	proc := []string{}

	for key, _ := range r.Procotol {
		if key != "xhr" {
			proc = append(proc, key)
		}
	}

	buffer := []byte{}

	r.Writer().Receive(func(d interface{}) {
		m, ok := d.(*MessagePack)

		if !ok {
			return
		}

		bits := goutils.MorphByte.Morph(m.Body)
		buffer = append(buffer, bits...)
	})

	r.Writer().Stream()

	// r.res.Header().Set("Content-Type", "charset=utf-8")
	r.res.Header().Set("Upgrades", strings.Join(proc, ";"))
	r.res.Header().Set("Content-Length", fmt.Sprint(len(buffer)))
	r.res.WriteHeader(200)
	r.res.Write(buffer)
}

func (r *XHRMirror) Write(data *MessagePack) {
	r.OutStream.Send(data)
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

	r.Socket = u

	//go routines run constantly to get messages sent into the read streams
	go func() {
		for {

			mtype, mesg, err := u.ReadMessage()

			if err != nil {
				log.Println("Socket Read Error", err)
				r.Socket.Close()
				break
			}

			packet := &MessagePack{"Socket", nil, mesg, mtype}
			r.Reader().Send(packet)
		}
	}()
}

func (r *WebSocketMirror) Write(data *MessagePack) {
	r.OutStream.Send(data)
}

func (r *WebSocketMirror) End() {
	writer := r.Writer()
	writer.Receive(func(data interface{}) {
		m, ok := data.(*MessagePack)

		if !ok {
			return
		}

		str := goutils.MorphByte.Morph(m.Body)
		err := r.Socket.WriteMessage(m.Bit, str)

		if err != nil {
			log.Println("Socket Write Error", err)
		}

	})
	writer.Stream()
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
		return RequestGlass(&WebSocketMirror{3, reqmirror, u.Protocols, nil})
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
			return RequestGlass(&JsonMirror{2, reqmirror, jscall[0], u.Protocols})
		}
	}

	reqmirror.Streamer = true
	return RequestGlass(&XHRMirror{1, reqmirror, u.Protocols})
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
