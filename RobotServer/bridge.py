# -*- coding: utf-8 -*-
import sys
import json
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer

# Mock Naoqi if not available
try:
    from naoqi import ALProxy
    HAS_NAOQI = True
except ImportError:
    HAS_NAOQI = False
    print "NAOqi libraries not found. Running in simulation mode."

ROBOT_IP = "192.168.1.108" # Change this to your Pepper's IP
ROBOT_PORT = 9559

class RobotController:
    def __init__(self):
        self.tts = None
        self.motion = None
        self.tablet = None
        if HAS_NAOQI:
            try:
                self.tts = ALProxy("ALTextToSpeech", ROBOT_IP, ROBOT_PORT)
                self.motion = ALProxy("ALMotion", ROBOT_IP, ROBOT_PORT)
                self.tablet = ALProxy("ALTabletService", ROBOT_IP, ROBOT_PORT)
                print "Connected to Pepper at " + ROBOT_IP
            except Exception as e:
                print "Could not connect to Pepper: " + str(e)

    def say(self, text):
        print "[Pepper Say]: " + text
        if self.tts:
            self.tts.say(str(text))

    def show_webview(self, url):
        print "[Pepper Show]: " + url
        if self.tablet:
            # Ensure Wifi is configured on Pepper
            self.tablet.showWebview(str(url))
            
    def hide_webview(self):
        print "[Pepper Hide Tablet]"
        if self.tablet:
            self.tablet.hideWebview()

robot = RobotController()

class RequestHandler(BaseHTTPRequestHandler):
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        # Allow CORS for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_POST(self):
        content_length = int(self.headers.getheader('content-length'))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data)
            action = data.get('action')
            payload = data.get('payload', {})
            
            response = {'status': 'success', 'message': 'Action received'}
            
            if action == 'say':
                text = payload.get('text', '')
                robot.say(text)
            elif action == 'show_view':
                url = payload.get('url', '')
                robot.show_webview(url)
            elif action == 'hide_view':
                robot.hide_webview()
            else:
                response = {'status': 'error', 'message': 'Unknown action'}
                
            self._set_headers()
            self.wfile.write(json.dumps(response))
            
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            print "Error processing request: " + str(e)

def run(server_class=HTTPServer, handler_class=RequestHandler, port=8001):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print 'Starting Robot Bridge Server on port %d...' % port
    httpd.serve_forever()

if __name__ == "__main__":
    run()
