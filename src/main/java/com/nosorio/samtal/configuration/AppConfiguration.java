package com.nosorio.samtal.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class AppConfiguration implements WebSocketConfigurer {

	// Test
	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
	    registry.addHandler(new SocketHandler(), "/socket").addHandler(new SamtalHandler(), "/samtal")
	      .setAllowedOrigins("*");
	}
}