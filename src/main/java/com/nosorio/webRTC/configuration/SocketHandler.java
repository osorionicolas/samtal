package com.nosorio.webRTC.configuration;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;

public class SocketHandler extends TextWebSocketHandler {
	
    List<WebSocketSession>sessions = new CopyOnWriteArrayList<>();
	private static final Gson gson = new GsonBuilder().create();

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message)
      throws InterruptedException, IOException {
		final JsonObject jsonMessage = gson.fromJson(message.getPayload(), JsonObject.class);

    	if(jsonMessage.get("id").getAsString().equals("ping")) {
    		session.sendMessage(new TextMessage("{ \"id\": \"pong\" }"));
    	}
    	else {
	        for (WebSocketSession webSocketSession : sessions) {
	            if (webSocketSession.isOpen() && !session.getId().equals(webSocketSession.getId())) {
	                webSocketSession.sendMessage(message);
	            }
	        }
    	}
    }

	@Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        for (WebSocketSession webSocketSession : sessions) {
            if (webSocketSession.isOpen() && session.getId().equals(webSocketSession.getId())) {
                webSocketSession.sendMessage(new TextMessage("{ \"id\": \"currentSession\", \"data\": \"" + session.getId() + "\" }"));
            }
            if (webSocketSession.isOpen()) {
                webSocketSession.sendMessage(new TextMessage("{ \"id\": \"sessions\", \"data\": \"" + this.getSessions() + "\" }"));
            }
        }
    }

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		sessions.remove(session);
		for (WebSocketSession webSocketSession : sessions) {
            if (webSocketSession.isOpen()) {
                webSocketSession.sendMessage(new TextMessage("{ \"id\": \"removeSession\", \"data\": \"" + session.getId() + "\" }"));
            }
        }
	}

	public String getSessions() {
		return this.sessions.stream().map(session -> session.getId()).collect(Collectors.joining(","));
	}

}