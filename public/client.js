
var localVideo
var isRoomCreator = false;
var socketCount = 0;
var socketId
let localStream
var connections = [];
let roomId
let user
var users
let eventList = new Map([])
// let mic_deaf = new Map([])
let children_len
let screen_stream
let hasFullScreen = false
let {width, height} = {}
var channels = []
var dataChannel 
var receiveChannel 
let receivedBuffers = [];
var filename


var latency

var iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
};

// sockets emits responses
      
socket.on('full-room' , () => {
      alert('Room is full')    
   })

 socket.on('create-room-answer' , answer => {
     if (answer)
        joinRoom(roomInput.val(), userInput.val())
     else
        alert(`Room with id #${roomInput.val()} already exists.`)
 })

 socket.on('join-room-answer' , answer => {
    if (answer)
       joinRoom(roomInput.val(), userInput.val())
    else
       alert(`Room with id #${roomInput.val()} does not exists.`) 
})
 

 socket.on('signal', gotMessageFromServer)
     
 socket.on('broadcast-message', function(id , message , startTime){
     calculateDelay(startTime)
     initRemoteMessage(id , message)
 })

 socket.on('participantsList', showParticipants)

 socket.on('user-left', function(id , startTime){

    calculateDelay(startTime)
    if (users){
        if (users.has(id)){

            console.log(`user ${users.get(id)} deleted`)
            users.delete(id)

            channels[id].close()

            //update server's users map
            socket.emit('delete' , id)

            //update participants list
            showParticipants()
        }
    }
 });

 socket.on("refactor" , function(id , usersArray) {

    if (hasFullScreen){
        selectedid = id
        UpdateMediumMenuView(id , eventList.get(id) , true)
        $(`#${id}`).remove()
    }
    users = new Map([])

    for (var i = 0; i < usersArray.length; i++){
        var us = new Map(JSON.parse(JSON.stringify(usersArray[i])));
        const [key] = us.keys()
        const [value] = us.values()
        users.set(key , value)
    }

    console.log("refactor",users)
    let usersIds = Array.from( users.keys() );

    while (video_div.children[0]) {
        video_div.removeChild(video_div.children[0]);
    }

    while (video_div_bottom.children[0]) {
        video_div_bottom.removeChild(video_div_bottom.children[0]);
    }

    console.log(medium.children().length)
   
    usersIds = Array.from( users.keys() );
    for (var i = 0; i < usersIds.length; i++){
        if (eventList.has(usersIds[i]) && usersIds[i] != socketId ){

            if (hasFullScreen){
                var count=0
                for (var j=0; j<medium.children().length; j++){
                    if ($(medium.children()[j]).attr('id') != usersIds[i]){
                        console.log("reinit stream",$(medium.children()[j]).attr('id'))
                        count++
                    }
                }
                //console.log('count' , count)
                if (count == medium.children().length) // ama to id den iparxei sti medium nav(epidi einai se fullscreen) tote ksanatopothise to sto fullscreen mode pou itan
                    setRemoteStream(eventList.get(usersIds[i]) , usersIds[i])

            }
            else{
                setRemoteStream(eventList.get(usersIds[i]) , usersIds[i])
            }
        }
    }

    // an diagrafitke video pou itan fullscreen tote pare to 1o video apto medium nav kai valto se fullscreen  
    if (video_div.children.length == 0 && medium.children().length > 0){
        console.log('rework' , $(medium.children()[0]).attr('id'))
        setRemoteStream(eventList.get($(medium.children()[0]).attr('id')) ,$(medium.children()[0]).attr('id'))
        $(medium.children()[0]).remove()
    }

    // remove background
    if (medium.children().length == 0){

        medium.attr('style' , 'visibility:hidden')
        medium.attr('style' , 'visibility:hidden')
        nav_background.attr('style' , 'border-top:none')  
        hasFullScreen = false

        $($("#fullscreen").children()[0]).attr('src' , '/assets/fullscreen.png')
        $($("#fullscreen").children()[0]).attr('title' , 'Normalscreen Enabled')
    }

 })

//  socket.on('change-stream', function(id ,event ,startTime){

//     calculateDelay(startTime)
//     console.log(document.getElementById(id))
//     document.getElementById(id).remove();

//     console.log(document.getElementById(id))

//     setRemoteStream(id , event)
//  });

 socket.on('user-joined' , function(startTime, id, usersArray){
    
    calculateDelay(startTime)
    //refactor map from given array
    users = new Map([])
    for (i = 0; i < usersArray.length; i++){
        var us = new Map(JSON.parse(JSON.stringify(usersArray[i])));
        const [key] = us.keys()
        const [value] = us.values()
        users.set(key , value)
    }
    console.log(users)
    let clients = Array.from( users.keys() );
    //clients : id of users
    clients.forEach(function(socketListId) {
         if(!connections[socketListId]){
             connections[socketListId] = new RTCPeerConnection(iceServers);

                if (socketListId != socketId){
                    dataChannel = connections[socketListId].createDataChannel(`datachannel`,{negotiated: true, id: 0})
                   // console.log(`created datachannel for ${socketListId}`)
                    channels[socketListId] = dataChannel //store datachannel to array for future send event

                    dataChannel.addEventListener('open', event => {
                        console.log('datachannel created' +" " + dataChannel.readyState +" sid" +socketListId)
                    });
                
                    //remake file from chunks sent from datachannel
                    dataChannel.addEventListener('message',async (event) =>{
                        
                        dataChannel.binaryType = 'arraybuffer';
                            const { data } = event;
                            try {
                                console.log("typeof data", typeof data)
                                if (typeof data  !== 'string') {
                                    receivedBuffers.push(data);
                                    console.log(data)
                                } 
                                //for simple text message 
                                else if(typeof data  == 'string' && receivedBuffers.length == 0){
                                    initRemoteMessage(socketListId , data)
                                    console.log(data)
                                }
                                //for FILE message 
                                else {
                                    const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
                                        const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength);
                                        tmp.set(new Uint8Array(acc), 0);
                                        tmp.set(new Uint8Array(arrayBuffer), acc.byteLength);
                                        return tmp;
                                    }, new Uint8Array());
                                    const blob = new Blob([arrayBuffer]);            
                                    filename = data
                                    receivedBuffers = []
                                    displayFileMessage(blob , socketListId)
                                }
                            } catch (err) {
                                console.log('Message transfer failed');
                            }
                        });
                }
            
             //Wait for their ice candidate       
             connections[socketListId].onicecandidate = function(){
                if(event.candidate != null) {
                    console.log('---sending ice candidate---');
                    socket.emit('signal', socketListId, JSON.stringify({'ice': event.candidate}));
                }
            }   

            // if fullscreen mode is enabled add the new stream to the bottom side menu
            if (hasFullScreen){
                console.log('fullscrenn adder' , socketListId)
                connections[socketListId].onaddstream = function(){
                    UpdateMediumMenuView(socketListId , event , false)
                }    
            }
            else{
                connections[socketListId].onaddstream = function(){
                    setRemoteStream(event, socketListId)
                }   
            }       

            //Add the local video stream
           localStream.getTracks().forEach(track => 
                senders.push(connections[socketListId].addTrack(track, localStream) )     
            );
        }
     });
     if(users.size >= 2){
         connections[id].createOffer().then(function(description){
             connections[id].setLocalDescription(description).then(function() {
                 console.log(`new user !  id: ${id}`)
                 socket.emit('signal', id, JSON.stringify({'sdp': connections[id].localDescription}));
             }).catch(e => console.log(e));        
         });
     }
 })    

function gotMessageFromServer(fromId, message) {

    var signal = JSON.parse(message)

    if(fromId != socketId) {
        if(signal.sdp){      
            connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {                
                if(signal.sdp.type == 'offer') {
                    connections[fromId].createAnswer().then(function(description){
                        connections[fromId].setLocalDescription(description).then(function() {
                            socket.emit('signal', fromId, JSON.stringify({'sdp': connections[fromId].localDescription}));
                        }).catch(e => console.log(e));        
                    }).catch(e => console.log(e));
                }
            }).catch(e => console.log(e));
        }
    
        if(signal.ice) {
            connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
        }                
    }
}

function setRemoteStream(event, id) {
    
    let children
    let children_bottom
    
    let arr
    console.log(id)
    eventList.set(id , event) // add the stream to a list for re-initalization if this is needed 
    

    const new_div = document.createElement('div')
    const new_video = document.createElement("video")
    const overlayDiv = document.createElement("div")
    const topText = document.createElement("p")
    const logo = document.createElement("img")

    overlayDiv.id = 'overlayDiv'
    topText.id = 'topText'
    logo.src ='/assets/client.png'

    topText.innerHTML = users.get(id)
    overlayDiv.appendChild(logo)
    overlayDiv.appendChild(topText)

    new_div.appendChild(overlayDiv)
    
    new_div.className = users.get(id)
    
    new_div.id = id
    new_div.position = 'relative'
    new_video.style.position = "relative"
    new_video.style.zIndex = "0"
    new_video.className= "video"
    
    new_video.srcObject = event.stream;
    new_video.play();
    new_video.autoplay = true
    
    if (video_div.children.length + video_div_bottom.children.length  < 3){
        video_div.appendChild(new_div)
        new_div.appendChild(new_video)
        children = video_div.children
        arr = Array.from(children)
        children_len = children.length
    }
    else{
        children = video_div.children
        children_len = children.length
        video_div_bottom.appendChild(new_div)
        new_div.appendChild(new_video)
        
        children_bottom = video_div_bottom.children
        children_len += children_bottom.length
    }

    console.log('children ' , children_len )

    if (children_len  >= 4){
        video_div.style.height = "35%"
        video_div_bottom.style.height = "35%"
        video_div_bottom.style.display = 'flex'
        video_div_bottom.style.margin = 'auto'
        video_div_bottom.style.alignItems = 'center'
        
        for (i of children){
            
            i.style.width = 100 / 4 +'%';
            console.log('calculated width ' , i.style.width )
            i.style.height = 'max-content';  
            i.style.margin = 'auto'
           //i.style.marginTop = '15px' // metakini pio panw tin prwti 5ada
            i.style.border = '6px solid #181818'      
        }
        for (i of children_bottom){ // kataskevi tis defteris 5adas
                
            i.style.width = 100 / (4) +'%';
            console.log('calculated width' , i.style.width)
            i.style.height = 'max-content';  
            i.style.margin = 'auto'
          //  i.style.marginTop= '15px'
            i.style.border = '6px solid #181818'  
        }
    }
    else if (children_len<4){

        if (children_len == 1){
            video_div_bottom.style.height = "0%"
            video_div.style.height = "70%"
            new_div.style.width = 'max-content'
            new_div.style.height = '97%'
            new_div.style.margin = 'auto'
            new_div.style.marginTop = '10px'
            
            
            new_video.style.height = '100%'
            new_div.style.border = '6px solid #181818'          
        }
        else{
            arr.forEach((item) =>{
                item.style.width = 100 / children_len +'%';
                console.log('calculated width ' , item.style.width )
                item.style.height = 'max-content';  
                item.style.margin = 'auto'
                
                item.style.border = '6px solid #181818'    
            })
        }     
    }  

    new_video.style.height = '100%'
    new_video.style.width = '100%'
}


function showParticipants() {
    
    participantsList.html('')

    const usernames = Array.from(users.values())
    usernames.forEach(function(name){
        participantsList.innerHTML += `<li> ${name} </li> `;
        participantsList.html(participantsList.html()+`<li> ${name} </li> `)
    })
}

function displayMessage(message) {
    message= message + "<br>"
    document.getElementById("chat-area").innerHTML += '<div class=chatroom-user>' + '<p>'+ message + '</p></div>';
    document.getElementById("message-input").value = ''

    for (id in channels){
        if (id != socketId && channels[id].readyState =='open')
            channels[id].send(message);
    }

    document.getElementById("chat-area").scrollTo(0,  document.getElementById("chat-area").scrollHeight);
}

function initRemoteMessage(id ,message){
    if (id != socketId)
        document.getElementById("chat-area").innerHTML += '<div class=chatroom-remote>'+ '<h3>'+users.get(id)+'</h3>'+'<p>'+ message+'</p></div>';

    document.getElementById("chat-area").scrollTo(0,  document.getElementById("chat-area").scrollHeight);
}

 function sendFile(file){
    if (file) {
       // console.log(`user ${socketId} is sending a file with ${file.size} size! with id : ${dataChannel.id}`)

        for (id in channels){
            if (id != socketId && channels[id].readyState =='open')
            channels[id].binaryType = 'arraybuffer'; 
        }

        file.arrayBuffer().then( async (buffer) =>{
                console.log('send file')
                console.log('id' , socketId)
                buffer = await file.arrayBuffer();
                for (let i = 0; i < buffer.byteLength; i += MAXIMUM_CHUNKFILE_SIZE) {
                    for (id in channels){
                        if (id != socketId && channels[id].readyState =='open')
                            channels[id].send(buffer.slice(i, i + MAXIMUM_CHUNKFILE_SIZE));
                    }
                }
                // notify other clients for the name of file
                for (id in channels){
                    if (id != socketId && channels[id].readyState =='open')
                        channels[id].send(`${file.name}`);
                }
            })
    }
}

function displayFileMessage(file ,id){

    var nameOfFile
    ImgSent = true

    if (socketId == id)
        nameOfFile = file.name.split(' ').join('-')
    else
        nameOfFile = filename.split(' ').join('-')

    filename = nameOfFile
    var message = nameOfFile + "<br>"
    const url = window.URL.createObjectURL(file);
    const chat_area = document.getElementById("chat-area")

    if (isImage(nameOfFile)){

        storeImg(file , url)

        if(socketId == id){
            chat_area.innerHTML += `<div class=chatroom-user>  <p>`+
            '<img id="image-message" class='+nameOfFile+ ' src='+URL.createObjectURL(file)+' onclick="getPics(this)"></p></div>'; 
        }
        else{
            chat_area.innerHTML += '<div class=chatroom-remote><h3>'+users.get(id)+'</h3><p>'+
         '<img id="image-message" class='+nameOfFile+ ' src='+URL.createObjectURL(file)+' onclick="getPics(this)"></p></div>'; 
        }
    }
    else{

        if (socketId == id){
            chat_area.innerHTML += '<div class=chatroom-user>  <p>'+
            '<a href="'+url+'" download="'+nameOfFile+'">' +
            '<img src="/assets/archive.png" id="archive-user">'+ message + '</a></p></div>';
        }
        else{
            chat_area.innerHTML += '<div class=chatroom-remote><h3>'+users.get(id)+'</h3><p>'+
            '<a href="'+url+'" download="'+nameOfFile+'">' +
            '<img src="/assets/archive.png" id="archive-remote">'+ message + '</a></p></div>';
        }
    }
    document.getElementById("chat-area").scrollTo(0, chat_area.scrollHeight);
}

