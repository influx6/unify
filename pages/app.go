package main

import (
	"fmt"
	"github.com/influx6/goutils"
	"github.com/influx6/grids"
	"github.com/influx6/unify"
	"github.com/influx6/webgrid"
	"net/http"
)

func main() {

	var _ interface{}

	unit := unify.CreateUnify(func(conn *unify.Unified) {
		if conn.Reader().BufferSize() <= 0 {
			//1 - means text-message, 2 - binary
			conn.WriteMessage("no message received! :( Bad Client!! Bad!! ", 1)
			conn.End()
			return
		}

		conn.Reader().Receive(unify.HandleMessagePack(func(msg *unify.MessagePack) {
			fmt.Println("reader not working!", msg, msg.Body)
			var data = goutils.MorphString.Morph(msg.Body)
			fmt.Println("data:", data)
			conn.WriteMessage("got your message: "+data, msg.Bit)
			conn.End()
		}))
		conn.Reader().Stream()
	}, []string{"xhr", "jsonp", "websocket"})

	app := webgrid.NewHttp()
	_ = webgrid.NewHttpConsole(app)

	index := webgrid.NewRoute("/", true)
	home := webgrid.NewFileView("./index.html")

	index.OutBind("yes", home.In("req"))

	assets := webgrid.NewRoute("/assets", false)
	static := webgrid.NewStatic(".", "/assets/")

	assets.OutBind("yes", static.In("req"))

	io := webgrid.NewRoute("/io", false)
	io.OrOut("yes", func(p *grids.GridPacket) {
		webgrid.UseHttpPacket(p, func(res http.ResponseWriter, req *http.Request) {
			unit.Serve(res, req)
		})
	})

	app.OutBind("res", assets.In("req"))
	app.OutBind("res", index.In("req"))
	app.OutBind("res", io.In("req"))

	err := http.ListenAndServe(":3000", app)

	if err != nil {
		panic("server exploded")
	}

}
