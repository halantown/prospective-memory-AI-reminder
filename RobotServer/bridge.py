# -*- coding: utf-8 -*-
"""
RobotServer Bridge - HTTP API for Pepper Robot Control
Runs on Python 2.7 (required by NAOqi SDK)

API Endpoints:
  GET  /         - Health check & status
  POST /         - Execute robot actions

Actions:
  say           - Text-to-speech
  stop_speaking - Interrupt current speech
  show_view     - Show webpage on tablet
  hide_view     - Hide tablet webview
  show_image    - Show image on tablet
  hide_image    - Hide tablet image
  wake_up       - Wake robot (enable stiffness, stand)
  rest          - Rest robot (crouch, disable stiffness)
  go_to_posture - Move to preset posture (Stand, StandInit, Sit, Crouch)
  set_volume    - Set TTS volume [0.0-1.0]
  set_language  - Set TTS language (English, Chinese, etc.)
  set_autonomous_life - Enable/disable autonomous behaviors
  move_head     - Move head to specific angles
"""
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

ROBOT_IP = "192.168.1.108"  # Change this to your Pepper's IP
ROBOT_PORT = 9559

class RobotController:
    def __init__(self):
        self.tts = None
        self.motion = None
        self.posture = None
        self.tablet = None
        self.auto_life = None
        self.speaking_id = None  # Track current speech task
        
        if HAS_NAOQI:
            try:
                self.tts = ALProxy("ALTextToSpeech", ROBOT_IP, ROBOT_PORT)
                self.motion = ALProxy("ALMotion", ROBOT_IP, ROBOT_PORT)
                self.posture = ALProxy("ALRobotPosture", ROBOT_IP, ROBOT_PORT)
                self.tablet = ALProxy("ALTabletService", ROBOT_IP, ROBOT_PORT)
                self.auto_life = ALProxy("ALAutonomousLife", ROBOT_IP, ROBOT_PORT)
                print "Connected to Pepper at " + ROBOT_IP
            except Exception as e:
                print "Could not connect to Pepper: " + str(e)

    def get_status(self):
        """Get comprehensive robot status."""
        status = {
            'connected': HAS_NAOQI,
            'robot_ip': ROBOT_IP,
            'tts_available': self.tts is not None,
            'motion_available': self.motion is not None,
            'tablet_available': self.tablet is not None
        }
        if HAS_NAOQI:
            try:
                if self.tts:
                    status['tts_volume'] = self.tts.getVolume()
                    status['tts_language'] = self.tts.getLanguage()
                if self.auto_life:
                    status['autonomous_state'] = self.auto_life.getState()
                if self.posture:
                    status['posture'] = self.posture.getPostureFamily()
            except Exception as e:
                print "Error getting status: " + str(e)
        return status

    # === Speech ===
    def say(self, text, blocking=False):
        """Speak text. Non-blocking by default."""
        print "[Pepper Say]: " + text
        if self.tts:
            if blocking:
                self.tts.say(str(text))
            else:
                self.speaking_id = self.tts.post.say(str(text))
        return {'speaking_id': self.speaking_id}

    def stop_speaking(self):
        """Stop current speech immediately."""
        print "[Pepper Stop Speaking]"
        if self.tts:
            self.tts.stopAll()
        self.speaking_id = None

    def set_volume(self, volume):
        """Set TTS volume [0.0-1.0]."""
        volume = max(0.0, min(1.0, float(volume)))
        print "[Pepper Volume]: " + str(volume)
        if self.tts:
            self.tts.setVolume(volume)

    def set_language(self, language):
        """Set TTS language (English, Chinese, etc.)."""
        print "[Pepper Language]: " + language
        if self.tts:
            try:
                self.tts.setLanguage(str(language))
            except Exception as e:
                print "Language not available: " + str(e)
                return False
        return True

    # === Tablet ===
    def show_webview(self, url):
        """Show webpage on tablet."""
        print "[Pepper Show Webview]: " + url
        if self.tablet:
            self.tablet.showWebview(str(url))

    def hide_webview(self):
        """Hide tablet webview."""
        print "[Pepper Hide Webview]"
        if self.tablet:
            self.tablet.hideWebview()

    def show_image(self, url):
        """Show image on tablet."""
        print "[Pepper Show Image]: " + url
        if self.tablet:
            self.tablet.showImage(str(url))

    def hide_image(self):
        """Hide tablet image."""
        print "[Pepper Hide Image]"
        if self.tablet:
            self.tablet.hideImage()

    # === Motion & Posture ===
    def wake_up(self):
        """Wake robot - enable stiffness and stand."""
        print "[Pepper Wake Up]"
        if self.motion:
            self.motion.wakeUp()

    def rest(self):
        """Rest robot - go to crouch and disable stiffness."""
        print "[Pepper Rest]"
        if self.motion:
            self.motion.rest()

    def go_to_posture(self, posture_name, speed=0.5):
        """Go to preset posture: Stand, StandInit, Sit, Crouch."""
        print "[Pepper Posture]: " + posture_name
        if self.posture:
            try:
                self.posture.goToPosture(str(posture_name), float(speed))
            except Exception as e:
                print "Posture error: " + str(e)
                return False
        return True

    def move_head(self, yaw=0.0, pitch=0.0, speed=0.2):
        """Move head. Yaw: left(+)/right(-), Pitch: down(+)/up(-)."""
        print "[Pepper Head]: yaw=" + str(yaw) + ", pitch=" + str(pitch)
        if self.motion:
            self.motion.setStiffnesses("Head", 1.0)
            self.motion.setAngles(["HeadYaw", "HeadPitch"], [float(yaw), float(pitch)], float(speed))

    # === Autonomous Life ===
    def set_autonomous_life(self, state):
        """Set autonomous life state: interactive, solitary, safeguard, disabled."""
        print "[Pepper Autonomous Life]: " + state
        if self.auto_life:
            try:
                self.auto_life.setState(str(state))
                # If disabling, ensure stiffness is maintained
                if state == "disabled" and self.motion:
                    self.motion.setStiffnesses("Body", 1.0)
            except Exception as e:
                print "Autonomous life error: " + str(e)
                return False
        return True


robot = RobotController()


class RequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Suppress default logging for cleaner output."""
        pass

    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        """Health check and status endpoint."""
        self._set_headers()
        response = robot.get_status()
        response['status'] = 'ok'
        self.wfile.write(json.dumps(response))

    def do_POST(self):
        content_length = int(self.headers.getheader('content-length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data)
            action = data.get('action')
            payload = data.get('payload', {})
            
            response = {'status': 'success', 'action': action}
            
            # === Speech Actions ===
            if action == 'say':
                text = payload.get('text', '')
                blocking = payload.get('blocking', False)
                result = robot.say(text, blocking)
                response.update(result)
            elif action == 'stop_speaking':
                robot.stop_speaking()
            elif action == 'set_volume':
                volume = payload.get('volume', 0.8)
                robot.set_volume(volume)
            elif action == 'set_language':
                language = payload.get('language', 'English')
                success = robot.set_language(language)
                response['success'] = success
                
            # === Tablet Actions ===
            elif action == 'show_view':
                url = payload.get('url', '')
                robot.show_webview(url)
            elif action == 'hide_view':
                robot.hide_webview()
            elif action == 'show_image':
                url = payload.get('url', '')
                robot.show_image(url)
            elif action == 'hide_image':
                robot.hide_image()
                
            # === Motion Actions ===
            elif action == 'wake_up':
                robot.wake_up()
            elif action == 'rest':
                robot.rest()
            elif action == 'go_to_posture':
                posture = payload.get('posture', 'StandInit')
                speed = payload.get('speed', 0.5)
                success = robot.go_to_posture(posture, speed)
                response['success'] = success
            elif action == 'move_head':
                yaw = payload.get('yaw', 0.0)
                pitch = payload.get('pitch', 0.0)
                speed = payload.get('speed', 0.2)
                robot.move_head(yaw, pitch, speed)
                
            # === Autonomous Life ===
            elif action == 'set_autonomous_life':
                state = payload.get('state', 'solitary')
                success = robot.set_autonomous_life(state)
                response['success'] = success
                
            # === Status ===
            elif action == 'status':
                response = robot.get_status()
                response['status'] = 'ok'
                
            else:
                response = {'status': 'error', 'message': 'Unknown action: ' + str(action)}
                
            self._set_headers()
            self.wfile.write(json.dumps(response))
            
        except Exception as e:
            self._set_headers(500)
            error_response = {'status': 'error', 'message': str(e)}
            self.wfile.write(json.dumps(error_response))
            print "Error processing request: " + str(e)


def run(server_class=HTTPServer, handler_class=RequestHandler, port=8001):
    server_address = ('0.0.0.0', port)
    httpd = server_class(server_address, handler_class)
    print '=' * 50
    print 'Robot Bridge Server'
    print '=' * 50
    print 'Port: %d' % port
    print 'Robot IP: %s' % ROBOT_IP
    print 'NAOqi Available: %s' % HAS_NAOQI
    print '=' * 50
    httpd.serve_forever()


if __name__ == "__main__":
    run()
