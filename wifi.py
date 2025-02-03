from flask import Flask,request
import subprocess

app = Flask(__name__)

wifi_device = "wlan1"

@app.route('/')
def index():
    result = subprocess.check_output(["nmcli", "--colors", "no", "-m", "multiline", "--get-value", "SSID", "dev", "wifi", "list", "ifname", wifi_device])
    ssids_list = result.decode().split('\n')
    dropdowndisplay = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Connect PERSYS to WiFi</title>
	    <style>
	    </style>
        </head>
        <body>
            <h3 style="color:#EDEDED;font-family:'Nunito',sans-serif;margin:5px;margin-bottom:15px;">Connect device to WiFi</h3>
            <form action="/submit" method="post">
                <label for="ssid" style="color:#EDEDED;font-family:'Nunito',sans-serif;margin:5px;">Choose a WiFi network:</label>
                <select name="ssid" id="ssid" style="background:#444444;border:0;padding:10px;color:#EDEDED;outline:none;border-radius:8px;margin:5px;">
        """
    for ssid in ssids_list:
        only_ssid = ssid.removeprefix("SSID:")
        if len(only_ssid) > 0:
            dropdowndisplay += f"""
                    <option value="{only_ssid}">{only_ssid}</option>
            """
    dropdowndisplay += f"""
                </select>
                <p/>
                <label for="password" style="color:#EDEDED;font-family:'Nunito',sans-serif;margin:5px;">WiFi Password:</label>
		<br/>
		<input type="password" name="password" style="background:#444444;color:#ededed;font-family:'Nunito',sans-serif;padding:10px;border:0;border-radius:8px;outline:none;margin:5px;" />
                <p/>
                <input type="submit" value="Connect" style="background:#86B5B5;color:#222222;padding:10px;border:0;border-radius:8px;cursor:pointer;margin:5px;">
            </form>
        </body>
        </html>
        """
    return dropdowndisplay


@app.route('/submit',methods=['POST'])
def submit():
    if request.method == 'POST':
        print(*list(request.form.keys()), sep = ", ")
        ssid = request.form['ssid']
        password = request.form['password']
        connection_command = ["nmcli", "--colors", "no", "device", "wifi", "connect", ssid, "ifname", wifi_device]
        if len(password) > 0:
          connection_command.append("password")
          connection_command.append(password)
        result = subprocess.run(connection_command, capture_output=True)
        if result.stderr:
            return "Error: failed to connect to wifi network: <i>%s</i>" % result.stderr.decode()
        elif result.stdout:
            return "Success: <i>%s</i>" % result.stdout.decode()
        return "Error: failed to connect."


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)