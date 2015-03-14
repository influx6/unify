#Unify
    Unify is a golang package created majorly for one purpose alone and that is to unify the different transport (Ajax,JSONP,WebSocket) method of the web into a single, usable API. It ensures that each transport adheres to specific API rules which allow simplified use and response handling despite which ever transport or method is used to request resources from any standard http sserver. Unify also comes with a js library to simplify the client sided communication but really anyone can build theirs as they feel or use the default internal transport as their server does not try to complicate its responses beyond a certain level to allow a simplified and easy use by anyone without being tied to one client-communication library

##Install
    
        go get github.com/influx6/unify

        //for the client sided library which is built using browserify
        npm install unify
    
    Then

        go install github.com/influx6/unify


##API
    Unify was created with the basic view of offloading the problems of dealing with multiple types of transport and to allow the developer to concentrate on creating their responses and not worry to much about how it gets there. Since the response types and approaches of JSONP, Ajax(Usual Http Request-Response) and WebSocket are different, Unify early on was built so as to hide all the differences and implementation details and simply provide a simple API that allows a standard request-response cycle although in the case of websocket the cycle does not continue beyond the initial first request hence why Unify was created to simplify wrap up the specific transport and leave the management and live time of that connection to the developer,in a sense it provides the basic simplification and gets out of the way so you don’t feel cornered into one way of working.


    -   **Unify.Unify**:struct
        The unify struct is the core of all unify operations and its provides transforming mechanism to turn any standard http.Request and http.Response into a Unified object that can handle the response nature of each event while still providing a simple and elegant API for access.

    -   **Unify.Unified**:struct
        Every Http.Request and Http.Response is wrapped into a Unified struct that encapsulates the ***Unify.RequestGlass*** transport which provides the respective transport write function for sending of responses to the request 

    -   **Unify.Transform(rw http.ResponseWriter,r *http.Request)**:Function
        This member member function is the real work,it calls a unexport function to create the necessary transport ,wrap the request and response and return the unified struct ready for use
        
    -   **Unify.Serve(rw http.ResponseWriter,r *http.Request)**:Function
        This member member provides the operation of taking http.Request and http.Response objects and performing the transformation and sending of to a callback ready to use them

    -   **Unify.ServeHTTP(rw http.ResponseWriter,r *http.Request)**:Function
        To ensure seamless and easy use of Unify with golang Http.Server instance,you can simply pass the unify instance to the server handler and have it seemless ready to convert the http.Request to unified requests structs. Underneath it simply calls the Unify.Serve member method

    -   ***Unified.MessagePack***:struct
        This struct defines the basic definition of what a reply/response to a unified resquest should contain and also is used to wrap the request body wether be it uri-encoded or binary data sent through the http.Request object.
        * Structure:

            ```
                type MessagePack struct {
                    Type string //a string indicating the transport,automatically set
                    Head interface{} //any data which you want as head, could be the params of the http.Request
                    Body interface{} //any data which you want as body, could be the []byte of the request body
                    Bit  int //mainly used to indicate the message type for websocket but for other transport its set to 1 which stands for text responses, its also internal set except for websocket replies
                }
            
            ```

    -   ***Unify.RequestGlass***:interface{}
        This interface defines the standard methods required for any struct to be a valid transport and enforces the use of ***Unified.MessagePack*** to encapsulate response to allow a unified message packet despite which transport underneath.  RequestGlass transports come with a read and write streams, where the data from each request is read into and the writes are fed into the response underlying Write method of each request type

    -   ***Unify.RequestGlass***.Write(m *MessagePacket)
        This is a member function provided by all transport and takes a message packet

    -   ***Unify.RequestGlass***.Reader() *evroll.Streams
        This is a member function returns the transport read streams which contain the body of the request

    -   ***Unify.RequestGlass***.Writer() *evroll.Streams
        This is a member function returns the transport write streams which takes the messagepack and writes the Unify.MessagePack.Body as the request response

    -   ***Unify.Unified***.Write(m *MessagePacket)
            See Unify.RequestGlass.Write(..)

    -   ***Unify.Unified***.Reader() *evroll.Streams
            See Unify.RequestGlass.Reader*()

    -   ***Unify.Unified***.Writer() *evroll.Streams
            See Unify.RequestGlass.Writer()

    -   ***Unify.HandleMessagePack()*** 
        This is a helper function wrap on the read stream of a request to handle type checking of request data into ***Unify.MessagePack***

    -   ***Unify.RequestGlass***.Headers() *evroll.Map
        This is a member function is returns a map wrapper which contains the headers of the request to be written at response time for the jsonp it passes it as the header value 
        
    -   ***Unify.Unified***.Headers() *evroll.Map
            See Unify.RequestGlass.Headers()

    -   ***Unify.RequestGlass***.End()
        This is a member function is called when the response is ready and is to be sent usually for jsonp and xhr these means the end of that single request but for websocket is simply sends off all data in the writer stream

    - ***Unify.RequestMirror***:struct
        This struct is the root struct for all transport or mirror types it provides basic properties for all to share. Also all mirrors are expected to provide upgrade information “Upgrades” either as maps in jsonp or response headers in case of the xhrmirror to indicate what possible upgrades are support to allow easy upgrade paths for any client

    - ***Unify.XHRMirror***:struct
        This struct defines and encapsulates the opertional technique of the response-request cycle, where a stand Http.Request is made such as an Ajax request or a standard http.ClientRequest.Has support for CORS(basic support)

    - ***Unify.JsonMirror***:struct
        This struct defines and encapsulates the opertional technique of the jsonp request method, with these approach although not required but in unified is Law that it responses be in JSON to allow a few meta information such as upgrade paths and possible response meta data be included in the response of the request. This watches any request uri and query parameters for two specific data, that is a `json=true` and a `callback=NAME_OF_CALLBACK`  which then indicates that its a jsonp request method else its just defaults to a standard xhr/request-response transport using the `Unify.XHRMirror`.

        *   JsonMirror JSON Response Format
            This is the general response format of the JSONP JsonMirror where it provides the necessary upgrades allow by the server and headers set by the response and the data which can be any marhsallable type which is the real response of the request
    
            ```
                {
                    upgrades: [xhr,websocket,...]
                    headers: {},
                    payload: response-data.....
                }
            ```

    - ***Unify.WebSocketMirror***:struct
        This struct defines and encapsulates the opertional technique of the websocket transport. Underneath is the [1]gorilla/websocket package upgrading the standard Http.Request into a websocket connection.

##Examples

    A basic Unify server:

        ```
            package main

            import (
                "github.com/influx6/goutils"
                "github.com/influx6/unify"
                "net/http"
            )

            func main() {

                unit := unify.CreateUnify(func(conn *unify.Unified) {

                    if conn.Reader().BufferSize() <= 0 {
                        conn.WriteMessage("no your message! :( Bad Client!! Bad!! ")
                        conn.End()
                        return
                    }

                    conn.Reader().Receive(unify.HandleMessagePack(func(msg *unify.MessagePack) {

                        //lets convert it into a string incase we have []bytes
                        var data = goutils.MorphString.Morph(msg.Body)

                        //lets just echo it back to them
                        conn.WriteMessage("got your message: "+data, msg.Bit)

                        //send the writes
                        conn.End()
                    }))

                    //call the .Stream() method to pull the data
                    conn.Reader().Stream()

                }, []string{
                    //list the upgrades you want to allow
                    "xhr", 
                    "jsonp", 
                    "websocket",
                })

                err := http.ListenAndServe(":3000", unit)

                if err != nil {
                    panic("server exploded")
                }

            }
                
        ```

    On client:
        Simply make request with the specified URL to get the responses:

        JSONP => http://localhost:3000/?jsonp=true&callback=callbacker
        Ajax => http://localhost:3000/
        Websocket => ws://localhost:3000/

