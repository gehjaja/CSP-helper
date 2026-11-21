using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

class Launcher {
    const int Port = 41763;
    const string Home = "http://127.0.0.1:41763/";
    static readonly Dictionary<string,string> Routes = new Dictionary<string,string>(StringComparer.Ordinal);
    static void Open() { Process.Start(new ProcessStartInfo(Home) { UseShellExecute = true }); }

    [STAThread]
    static void Main(string[] args) {
        Application.EnableVisualStyles();
        using (var mutex = new Mutex(false, "Local\\CspHelperOffline41763")) {
            if (!mutex.WaitOne(0)) { Open(); return; }
            var site = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "site");
            foreach (var file in Directory.GetFiles(site, "*", SearchOption.AllDirectories))
                Routes.Add("/" + file.Substring(site.Length+1).Replace('\\','/'), file);
            Routes["/"] = Routes["/index.html"];
            var listener = new TcpListener(IPAddress.Loopback, Port);
            try { listener.Start(); }
            catch (SocketException) { MessageBox.Show("本地端口 41763 已被占用，请关闭占用程序后重试。"); return; }
            var thread = new Thread(() => {
                try { while (true) { var client = listener.AcceptTcpClient(); ThreadPool.QueueUserWorkItem(_ => Serve(client)); } }
                catch (SocketException) { }
            });
            thread.IsBackground = true; thread.Start();
            var window = new Form { Text = "CSP 备考助手 · 离线版", Width = 420, Height = 155, StartPosition=FormStartPosition.CenterScreen };
            var label = new Label { Text = "练习期间请保留此窗口。关闭窗口即可退出离线服务。", Dock=DockStyle.Top, Height=44, Padding=new Padding(8) };
            var button = new Button { Text = "打开本地题库", Dock=DockStyle.Top, Height=38 };
            button.Click += (s,e) => Open(); window.Controls.Add(button); window.Controls.Add(label);
            if (Array.IndexOf(args, "--test") < 0) window.Shown += (s,e) => Open();
            Application.Run(window);
            listener.Stop();
        }
    }

    static void Serve(TcpClient client) {
        using (client) try {
            client.ReceiveTimeout=4000; client.SendTimeout=15000;
            var stream=client.GetStream();
            var header=new List<byte>();
            while (header.Count < 16384) {
                int b=stream.ReadByte(); if (b<0) return; header.Add((byte)b);
                int n=header.Count;
                if(n>=4 && header[n-4]==13 && header[n-3]==10 && header[n-2]==13 && b==10) break;
            }
            string[] lines=Encoding.ASCII.GetString(header.ToArray()).Split(new[]{"\r\n"},StringSplitOptions.None);
            string[] req=lines[0].Split(' ');
            string file;
            if(req.Length!=3 || req[0]!="GET" || !Array.Exists(lines,l=>l.Equals("Host: 127.0.0.1:41763",StringComparison.OrdinalIgnoreCase)) || !Routes.TryGetValue(req[1].Split('?')[0],out file)){
                Write(stream,"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); return;
            }
            string type="application/octet-stream";
            switch(Path.GetExtension(file)){
                case ".html":type="text/html; charset=utf-8";break;
                case ".js":type="text/javascript";break;
                case ".wasm":type="application/wasm";break;
                case ".png":type="image/png";break;
                case ".json":type="application/json";break;
                case ".webmanifest":type="application/manifest+json";break;
            }
            using(var data=File.OpenRead(file)){
                string cors=req[1].StartsWith("/runtime/",StringComparison.Ordinal)?"Access-Control-Allow-Origin: *\r\n":"";
                Write(stream,"HTTP/1.1 200 OK\r\nContent-Type: "+type+"\r\nCache-Control: no-store\r\n"+cors+"Content-Length: "+data.Length+"\r\nConnection: close\r\n\r\n");
                data.CopyTo(stream);
            }
        } catch(IOException) { } catch(SocketException) { }
    }
    static void Write(Stream stream,string text){byte[] bytes=Encoding.ASCII.GetBytes(text);stream.Write(bytes,0,bytes.Length);}
}
