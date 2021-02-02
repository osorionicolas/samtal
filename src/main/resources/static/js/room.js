const video = document.getElementById("video");
const remoteVideo = document.getElementById("remoteVideo");
const input = document.getElementById("messageInput");
//const ws = new WebSocket('wss://secretcolossus.ddns.net/socket');
const ws = new WebSocket('ws://localhost:8080/samtal');

const urlParams = new URLSearchParams(window.location.search);
const name = urlParams.get('name');
const room = urlParams.get('room');
let participants = {};
let peerConnection, remoteStream, dataChannel, localStream, uid;

window.onbeforeunload = () => leaveRoom();

$(() => {   

    $("#volume").on('input', event => {
        const volume = $(event.currentTarget).val() / 10;
        remoteVideo.volume = volume;
    })
    
    $('[data-toggle="popover"]').popover({
        html: true,
        content: function() {
          return $('#popover-content').html();
        }
    })
        
    $('body').on('click', e => {
        //did not click a popover toggle, or icon in popover toggle, or popover
        if ($(e.target).data('toggle') !== 'popover'
            && $(e.target).parents('[data-toggle="popover"]').length === 0
            && $(e.target).parents('.popover.in').length === 0) { 
            $('[data-toggle="popover"]').popover('hide');
        }
    });
    
    $('#chatBtn').on('click', function () {
    	$('#myModal').modal({
    		backdrop: false,
    		show: true
    	});

    	$('.modal-dialog').draggable({
    		handle: ".modal-body"
    	});
  
    	$('.modal-content').resizable({
    		minHeight: 300,
    		minWidth: 250
    	});
    });
       
});


register = () => {
	const message = {
		id : 'joinRoom',
		name : name,
		room : room,
	}
	send(message);
}
	
	
startVideo = async (wasShared) =>{
    try {
        localStream = await navigator.mediaDevices.getUserMedia({'video': true, 'audio': true});
        video.srcObject = localStream;
        mute();
        if(wasShared) peerConnection.getSenders()[1].replaceTrack(localStream.getVideoTracks()[0]);
    } catch(error) {
        console.error('Error opening video camera.', error);
        ws.close();
    }
}

shareScreen = async () =>{
    try {
    	localStream = await navigator.mediaDevices.getDisplayMedia({'video': true, 'audio': true});
    	peerConnection.getSenders()[1].replaceTrack(localStream.getVideoTracks()[0]);
    	localStream.oninactive = () => {
    		startVideo(true);
    	}
    } catch(error) {
        console.error('Error sharing screen', error);
    }
}

mirror = targetVideo => targetVideo.classList.toggle("mirror");

changeLayout = () => {

}

mute = () => video.muted = true;

ping = () => setInterval(() => send({
	id : 'ping'
}), 50000);


var mediaIcon = {
	"audio":{
		true:"fa-microphone",
		false:"fa-microphone-slash inactive"
	},
	"video":{
		true:"fa-video",
		false:"fa-video-slash inactive"
	}
}

//track.stop() apaga la camara
toggleMedia = kind => {
    let track = localStream.getTracks().find(track => track.kind === kind); 
    track.enabled = !track.enabled;
    $("#" + kind + "Icon").addClass(mediaIcon[kind][track.enabled]).removeClass(mediaIcon[kind][!track.enabled]);
};

generatePeerConnection = () => {
    const configuration = { iceServers: [
        { urls: 'turn:secretcolossus.ddns.net:3478', username: 'nosorio', credential: 'nosorio' }
    ]};

	return new RTCPeerConnection(configuration, {
	    optional : [ {
	        RtpDataChannels : true
	    } ]
	});
}

ws.onopen = () => {
	console.log("Connected to the signaling server");
	register();
    initialize();
    ping();
};

ws.onmessage = msg => {
    content = JSON.parse(msg.data)

    var data = content.data;
    switch (content.id) {
	    // when somebody wants to call us
	    case "offer":
	        handleOffer(data);
	        break;
	    case "answer":
	        handleAnswer(data);
	        break;
	    // when a remote peer sends an ice candidate to us
	    case "onIceCandidate":
	        handleCandidate(data);
	        break;
	    case "mirror":
	    	mirror(remoteVideo);
	    	break;
	    case "currentSession":
	    	uid = data;
	    	break;
	    case "removeSession":
			onParticipantLeft(data);
			break;
	    case "sessions":
	    	data.split(",").forEach(participant => participants[participant] = { peerConnection: generatePeerConnection(), dataChannel });
	    	console.log(participants);
			break;


		case 'existingParticipants':
			onExistingParticipants(content);
			break;
		case 'newParticipantArrived':
			onNewParticipant(content);
			break;
		case 'participantLeft':
			onParticipantLeft(data);
			break;
		case 'receiveVideoAnswer':
			receiveVideoResponse(content);
			break;
		case 'iceCandidate':
			participants[content.name].rtcPeer.addIceCandidate(content.candidate, function (error) {
				if (error) {
				console.error("Error adding candidate: " + error);
				return;
				}
			});
			break;
	    default:
	        break;
    }
};

send = (message) => ws.send(JSON.stringify(message));

async function initialize() {
    await startVideo();
    peerConnection = generatePeerConnection();
	remoteStream = new MediaStream();
	remoteVideo.srcObject = remoteStream;

	// Setup ice handling
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            send({
				id : "onIceCandidate",
				candidate : event.candidate,
				data : event.candidate,
				name : name
            });
        }
    };
    
    peerConnection.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream);
    });	

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
	 
	localStream.onaddtrack = createOffer();

    // creating data channel
    dataChannel = peerConnection.createDataChannel("dataChannel", {
        reliable : true
    });

    // when we receive a message from the other peer, printing it on the console
    dataChannel.onmessage = event => $("#chat").append("<span class='message messageResponse'>" + event.data + "</span><br>");
}

createOffer = () => {
    peerConnection.createOffer({
    	iceRestart: true
    }).then(offer => {
        peerConnection.setLocalDescription(offer);
        send({
            id : "offer",
            data : offer
        });
    }).catch(error => {
    	console.error("Error creating an offer", error);
    });
}

handleOffer = (offer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // create and send an answer to an offer
    peerConnection.createAnswer().then( answer => {
        peerConnection.setLocalDescription(answer);
        send({
            id : "answer",
            data : answer
        });
        $("#volume").show();
    }).catch(error => {
        console.error("Error creating an answer", error);
    });

};

handleCandidate = (candidate) => peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

handleAnswer = (answer) => {
    $("#volume").show();
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("connection established successfully!!");
};

leaveRoom = () => {
	send({
		id : 'leaveRoom'
	});

	/*for ( var key in participants) {
		participants[key].dispose();
	}*/

	ws.close();
	window.location.replace("/");
}

sendMirror = () => {
	mirror(video);
	send({
        id : "mirror"
    });
}

sendMessage = () => {
    $("#chat").append("<span class='message'>" + "<b>Tu:</b> " + input.value + "</span><br>");
    try{
    	dataChannel.send(input.value);
    }
    catch(e){}
	input.value = "";
}

function onParticipantLeft(participant) {
	participants[participant].peerConnection.close(); //Sirve?
	delete participants[participant];
	remoteVideo.srcObject = remoteStream; //Sirve?
	$("#volume").hide();
}

function onNewParticipant(request) {
	receiveVideo(request.name);
}

function receiveVideoResponse(result) {
	participants[result.name].rtcPeer.processAnswer (result.sdpAnswer, function (error) {
		if (error) return console.error (error);
	});
}


function onExistingParticipants(msg) {
	var constraints = {
		audio : true,
		video : {
			mandatory : {
				maxWidth : 320,
				maxFrameRate : 15,
				minFrameRate : 15
			}
		}
	};
	console.log(name + " registered in room " + room);
	var participant = new Participant(name);
	participants[name] = participant;
	var video = participant.getVideoElement();

	var options = {
	      localVideo: video,
	      mediaConstraints: constraints,
	      onicecandidate: participant.onIceCandidate.bind(participant)
	    }
	participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options,
		function (error) {
		  if(error) {
			  return console.error(error);
		  }
		  this.generateOffer (participant.offerToReceiveVideo.bind(participant));
	});

	msg.data.forEach(receiveVideo);
}

function receiveVideo(sender) {
	var participant = new Participant(sender);
	participants[sender] = participant;
	var video = participant.getVideoElement();

	var options = {
      remoteVideo: video,
      onicecandidate: participant.onIceCandidate.bind(participant)
    }

	participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
			function (error) {
			  if(error) {
				  return console.error(error);
			  }
			  this.generateOffer (participant.offerToReceiveVideo.bind(participant));
	});;
}

/**
 * Creates a video element for a new participant
 *
 * @param {String} name - the name of the new participant, to be used as tag
 *                        name of the video element.
 *                        The tag of the new element will be 'video<name>'
 * @return
 */
function Participant(name) {
	this.name = name;
	var container = document.createElement('div');
	container.id = name;
	var span = document.createElement('span');
	var video = document.createElement('video');
	var rtcPeer;

	container.appendChild(video);
	container.appendChild(span);
	document.getElementById('participants').appendChild(container);

	span.classList.add("name")
	span.appendChild(document.createTextNode(name));

	video.id = 'video-' + name;
	video.autoplay = true;
	video.controls = false;


	this.getElement = function() {
		return container;
	}

	this.getVideoElement = function() {
		return video;
	}

	this.offerToReceiveVideo = function(error, offerSdp, wp){
		if (error) return console.error ("sdp offer error")
		console.log('Invoking SDP offer callback function');
		var msg =  { id : "receiveVideoFrom",
				sender : name,
				sdpOffer : offerSdp
			};
		send(msg);
	}

	this.onIceCandidate = function (candidate, wp) {
		  console.log("Local candidate" + JSON.stringify(candidate));

		  var message = {
		    id: 'onIceCandidate',
		    candidate: candidate,
		    name: name
		  };
		  send(message);
	}

	Object.defineProperty(this, 'rtcPeer', { writable: true});

	this.dispose = function() {
		console.log('Disposing participant ' + this.name);
		this.rtcPeer.dispose();
		container.parentNode.removeChild(container);
	};
}