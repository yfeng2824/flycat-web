/* eslint-disable no-restricted-globals */
import {
  FromPostMsg,
  FromWorkerMessageData,
  FromWorkerMessageType,
  ToPostMsg,
  ToWorkerMessageType,
} from './type';
import {
  addRelays,
  callApi,
  closePort,
  disconnect,
  listenFromPool,
  pullRelayStatus,
  pool,
  switchRelays,
  pullRelayGroupId,
} from './pool';
import { getPortIdFomSubId } from 'core/worker/util';
import { EventSubResponse } from 'core/nostr/type';

//let count = 0;

/**
 * the worker and callWorker (1-to-many) are communicating through SharedWorker
 * while the worker and Pool(ws manager) instance (1-to-1) are communicating through eventEmitter
 */

const connectedPorts: (MessagePort | null)[] = [];

self.onconnect = (evt: MessageEvent) => {
  const port = evt.ports[0];
  port.start();
  port.onmessage = (event: MessageEvent) => {
    const res: ToPostMsg = event.data;
    const data = res.data;
    const type = res.type;

    switch (type) {
      case ToWorkerMessageType.SWITCH_RELAYS:
        console.log('SWITCH_RELAYS');
        // switchRelays(data.switchRelays!, data.portId);
          pool.doSwitchRelays(data.switchRelays!);
        break;

      case ToWorkerMessageType.ADD_RELAY_URL:
        console.log('ADD_RELAY_URL');
        //addRelays(data.urls!, data.portId);
        pool.doAddRelays(data.urls!);
        break;

      case ToWorkerMessageType.PULL_RELAY_STATUS:
        {
          console.log('PULL_RELAY_STATUS');
        // pullRelayStatus(data.portId);
        const msg: FromWorkerMessageData = {
          wsConnectStatus: pool.wsConnectStatus,
        };
        port.postMessage({
          data: msg,
          type: FromWorkerMessageType.WS_CONN_STATUS,
        });
        }
        
        break;

        case ToWorkerMessageType.GET_RELAY_GROUP_ID:
          {
            console.log('GET_RELAY_GROUP_ID');
          //pullRelayGroupId(data.portId);
          const msg: FromWorkerMessageData = {
            relayGroupId: pool.switchRelays.id
          };
          port.postMessage({
            data: msg,
            type: FromWorkerMessageType.RELAY_GROUP_ID,
          });
          }
          break;

      case ToWorkerMessageType.CALL_API:
        //console.log('CALL_API', data.callMethod!, data.callData!);
        callApi(data.callMethod!, data.callData!, data.portId, {
          type: data.callRelayType,
          data: data.callRelayUrls,
        });
        break;

      

      case ToWorkerMessageType.DISCONNECT:
        console.log('DISCONNECT');
        //disconnect(data.portId);
        pool.closeAll();
        break;

      case ToWorkerMessageType.CLOSE_PORT:
        connectedPorts[data.portId] = null;
        closePort(data.portId);
        break;

      default:
        break;
    }
  };
  connectedPorts.push(port);

  // post the portId to callWorker
  const msg: FromPostMsg = {
    type: FromWorkerMessageType.PORT_ID,
    data: {
      portId: connectedPorts.length - 1,
    },
  };
  port.postMessage(msg);
};

listenFromPool(
  (message: FromWorkerMessageData) => {
    if (message.wsConnectStatus) {
      connectedPorts.forEach(port => {
        if (port != null)
          port.postMessage({
            data: message,
            type: FromWorkerMessageType.WS_CONN_STATUS,
          });
      });
    }
  },
  (message: FromWorkerMessageData) => {
    if (message.nostrData) {
      // currently we only relay the EventSubResponse
      // todo: maybe all types?
      const msg: EventSubResponse = JSON.parse(message.nostrData);
      const subId = msg[1];
      const portId = getPortIdFomSubId(subId);
      if (portId) {
        connectedPorts[portId]?.postMessage({
          data: message,
          type: FromWorkerMessageType.NOSTR_DATA,
        });
        return;
      }

      // send to all ports
      connectedPorts.forEach(port => {
        if (port != null) {
          port.postMessage({
            data: message,
            type: FromWorkerMessageType.NOSTR_DATA,
          });
        }
      });
    }
  },
  (message: FromWorkerMessageData) => {
    if (message.relayGroupId) {
      connectedPorts.forEach(port => {
        if (port != null)
          port.postMessage({
            data: message,
            type: FromWorkerMessageType.RELAY_GROUP_ID,
          });
      });
    }
  },
);

self.addEventListener('disconnect', e => {
  // todo: seems not triggering?
  console.log('port disconnected', e);
});

setInterval(() => {
  console.debug(
    `Ports: total ${connectedPorts.length}, connected ${
      connectedPorts.filter(p => p != null).length
    }`,
  );
}, 10 * 1000);

pool.startMonitor();

export {};
