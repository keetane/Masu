import AppKit
import Network

// Serve only files shipped with the application. No incoming request becomes a filesystem path.
final class Launcher: NSObject, NSApplicationDelegate {
    private var listener: NWListener?
    private var assets: [String:(Data,String)] = [:]
    private let port: UInt16 = 49831
    private var ready = false
    private var home: URL { URL(string: "http://127.0.0.1:\(port)/")! }
    private func fail(_ message: String) {
        let log = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/Masu-launcher.log")
        let line = "\(Date()) \(message)\n"
        do { try Data(line.utf8).write(to: log, options: .atomic) } catch { NSLog("%@", line) }
        let alert = NSAlert()
        alert.messageText = "Masuを起動できませんでした"
        alert.informativeText = message + "\n" + log.path
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
        NSApp.terminate(nil)
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu(), item = NSMenuItem(), submenu = NSMenu()
        menu.addItem(item); item.submenu = submenu
        submenu.addItem(withTitle: "Masuを終了", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        NSApp.mainMenu = menu
        do {
            let root = Bundle.main.resourceURL!.appendingPathComponent("web")
            let mime = ["html":"text/html; charset=utf-8","js":"text/javascript","css":"text/css","svg":"image/svg+xml","txt":"text/plain; charset=utf-8"]
            if let files = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) {
                for case let url as URL in files {
                    guard let type = mime[url.pathExtension] else { continue }
                    let path = String(url.path.dropFirst(root.path.count))
                    assets[path] = (try Data(contentsOf: url),type)
                }
            }
            guard let index = assets["/index.html"] else { fail("アプリ内のWebファイルが見つかりません。"); return }
            assets["/"] = index
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
            let server = try NWListener(using: parameters)
            listener = server
            server.newConnectionHandler = { [weak self] conn in self?.accept(conn) }
            server.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .ready: self.ready = true; self.openBrowser()
                case .failed(let error): self.fail("ローカルポート \(self.port) を利用できません。\n\(error.localizedDescription)")
                default: break
                }
            }
            server.start(queue: .main)
        } catch { fail(error.localizedDescription) }
    }
    func openBrowser() {
        if !NSWorkspace.shared.open(home) { fail("既定ブラウザを開けません。 " + home.absoluteString) }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if ready { openBrowser() }; return true
    }
    private func accept(_ conn: NWConnection) {
        conn.start(queue: .main)
        let timeout = DispatchWorkItem { conn.cancel() }
        DispatchQueue.main.asyncAfter(deadline: .now()+5, execute: timeout)
        func receive(_ prefix: Data) {
            conn.receive(minimumIncompleteLength: 1, maximumLength: 8192) { chunk, _, finished, error in
                guard let chunk = chunk, error == nil else { conn.cancel(); return }
                let data = prefix + chunk
                guard data.count <= 16384 else { conn.cancel(); return }
                let header = String(decoding: data, as: UTF8.self)
                guard header.contains("\r\n\r\n") else {
                    if finished { conn.cancel() } else { receive(data) }; return
                }
                let lines = header.components(separatedBy: "\r\n")
                let fields = lines[0].split(separator: " ")
                let host = lines.contains { $0.lowercased() == "host: 127.0.0.1:\(self.port)" }
                let valid = fields.count == 3 && fields[0] == "GET" && host
                let path = valid ? String(fields[1].split(separator:"?",maxSplits:1).first ?? "") : ""
                let asset = self.assets[path]
                let body = asset?.0 ?? Data()
                var response = Data("HTTP/1.1 \(asset == nil ? "404 Not Found" : "200 OK")\r\nContent-Type: \(asset?.1 ?? "text/plain")\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n".utf8)
                response.append(body)
                conn.send(content:response, completion:.contentProcessed { _ in timeout.cancel(); conn.cancel() })
            }
        }
        receive(Data())
    }
}
let delegate = Launcher()
let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
