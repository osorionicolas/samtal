package com.nosorio.samtal.configuration;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

import org.kurento.client.IceCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.ClassPathXmlApplicationContext;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.nosorio.samtal.models.Room;
import com.nosorio.samtal.models.UserSession;
import com.nosorio.samtal.services.RoomService;
import com.nosorio.samtal.services.UserService;

public class SamtalHandler extends TextWebSocketHandler {

	ApplicationContext context = new ClassPathXmlApplicationContext("bean-config.xml");
	private RoomService roomService = (RoomService) context.getBean("roomService");
	private UserService userService = (UserService) context.getBean("userService");

	List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

	private static final Logger log = LoggerFactory.getLogger(SamtalHandler.class);
	private static final Gson gson = new GsonBuilder().create();

	@Override
	public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		final JsonObject jsonMessage = gson.fromJson(message.getPayload(), JsonObject.class);

		final UserSession user = userService.getBySession(session);

		if (user != null) {
			log.debug("Incoming message from user '{}': {}", user.getName(), jsonMessage);
		} else {
			log.debug("Incoming message from new user: {}", jsonMessage);
		}

		switch (jsonMessage.get("id").getAsString()) {
		case "joinRoom":
			joinRoom(jsonMessage, session);
			break;
		case "receiveVideoFrom":
			final String senderName = jsonMessage.get("sender").getAsString();
			final UserSession sender = userService.getByName(senderName);
			final String sdpOffer = jsonMessage.get("sdpOffer").getAsString();
			user.receiveVideoFrom(sender, sdpOffer);
			break;
		case "leaveRoom":
			leaveRoom(user);
			break;
		case "onIceCandidate":
			JsonObject candidate = jsonMessage.get("candidate").getAsJsonObject();

			if (user != null) {
				IceCandidate cand = new IceCandidate(candidate.get("candidate").getAsString(),
						candidate.get("sdpMid").getAsString(), candidate.get("sdpMLineIndex").getAsInt());
				user.addCandidate(cand, jsonMessage.get("name").getAsString());
			}
			break;
		case "ping":
			session.sendMessage(new TextMessage("{ \"id\": \"pong\" }"));
			break;
		default:
			break;

		/*
		 * for (WebSocketSession webSocketSession : sessions) { if
		 * (webSocketSession.isOpen() &&
		 * !session.getId().equals(webSocketSession.getId())) {
		 * webSocketSession.sendMessage(message); } }
		 */
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		sessions.remove(session);
		for (WebSocketSession webSocketSession : sessions) {
			if (webSocketSession.isOpen()) {
				webSocketSession.sendMessage(
						new TextMessage("{ \"id\": \"removeSession\", \"data\": \"" + session.getId() + "\" }"));
			}
		}
		UserSession user = userService.removeBySession(session);
		roomService.getRoom(user.getRoomName()).leave(user);
	}

	public String getSessions() {
		return this.sessions.stream().map(session -> session.getId()).collect(Collectors.joining(","));
	}

	private void joinRoom(JsonObject params, WebSocketSession session) throws IOException {
		final String roomName = params.get("room").getAsString();
		final String name = params.get("name").getAsString();
		// log.info("PARTICIPANT {}: trying to join room {}", name, roomName);

		Room room = roomService.getRoom(roomName);
		final UserSession user = room.join(name, session);
		userService.register(user);
	}

	private void leaveRoom(UserSession user) throws IOException {
		final Room room = roomService.getRoom(user.getRoomName());
		room.leave(user);
		if (room.getParticipants().isEmpty()) {
			roomService.removeRoom(room);
		}
	}
}
