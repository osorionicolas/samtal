package com.nosorio.samtal.services;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.kurento.client.KurentoClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.nosorio.samtal.models.Room;

public class RoomService {

	  private final Logger log = LoggerFactory.getLogger(RoomService.class);

	  private KurentoClient kurento;

	  public KurentoClient getKurento() {
		return kurento;
	}

	public void setKurento(KurentoClient kurento) {
		this.kurento = kurento;
	}

	private final ConcurrentMap<String, Room> rooms = new ConcurrentHashMap<>();

	  /**
	   * Looks for a room in the active room list.
	   *
	   * @param roomName
	   *          the name of the room
	   * @return the room if it was already created, or a new one if it is the first time this room is
	   *         accessed
	   */
	  public Room getRoom(String roomName) {
	    log.debug("Searching for room {}", roomName);
	    Room room = rooms.get(roomName);

	    if (room == null) {
	      log.debug("Room {} not existent. Will create now!", roomName);
	      room = new Room(roomName, this.kurento.createMediaPipeline());
	      rooms.put(roomName, room);
	    }
	    log.debug("Room {} found!", roomName);
	    return room;
	  }

	  /**
	   * Removes a room from the list of available rooms.
	   *
	   * @param room
	   *          the room to be removed
	   */
	  public void removeRoom(Room room) {
	    this.rooms.remove(room.getName());
	    room.close();
	    log.info("Room {} removed and closed", room.getName());
	  }
}
