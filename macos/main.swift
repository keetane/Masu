import AppKit
import Network
import Darwin

// Serve only files shipped with the application. No incoming request becomes a filesystem path.
final class Launcher: NSObject, NSApplicationDelegate {
    private var listeners: [NWListener] = []
    private var readyListeners = 0
    private var lanAddresses: [String] = []
    private var assets: [String:(Data,String)] = [:]
    private let port: UInt16 = 49831
    private var ready = false
    private var home: URL { URL(string: "http://\(lanAddresses.first ?? "127.0.0.1"):\(port)/")! }
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
    private func localAddresses() -> [String] {
        var head: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&head) == 0 else { return [] }
        defer { freeifaddrs(head) }
        var addresses: [String] = []
        var current = head
        while let entry = current {
            defer { current = entry.pointee.ifa_next }
            guard let socket = entry.pointee.ifa_addr,
                  socket.pointee.sa_family == UInt8(AF_INET),
                  (entry.pointee.ifa_flags & UInt32(IFF_UP)) != 0,
                  String(cString: entry.pointee.ifa_name).hasPrefix("en") else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(socket, socklen_t(socket.pointee.sa_len), &host,
                              socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 else { continue }
            let ip = String(cString: host)
            let parts = ip.split(separator: ".").compactMap { Int($0) }
            guard parts.count == 4 else { continue }
            let isPrivate = parts[0] == 10 ||
                (parts[0] == 172 && (16...31).contains(parts[1])) ||
                (parts[0] == 192 && parts[1] == 168)
            if isPrivate && !addresses.contains(ip) { addresses.append(ip) }
        }
        return addresses.sorted()
    }
    @objc private func copyPhoneAddress() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(home.absoluteString, forType: .string)
    }
    @objc private func showPhoneAddress() {
        let alert = NSAlert()
        alert.messageText = "iPhoneでMasuを開く"
        alert.informativeText = lanAddresses.isEmpty ?
            "LAN用の接続が見つかりません。MacをWi-Fiに接続してMasuを起動し直してください。" :
            "MacとiPhoneを同じWi-Fiに接続し、Safariで次のアドレスを開いてください。\n\n" +
            home.absoluteString + "\n\nMacでMasuを起動している間、利用できます。"
        alert.addButton(withTitle: "アドレスをコピー")
        alert.addButton(withTitle: "閉じる")
        NSApp.activate(ignoringOtherApps: true)
        if alert.runModal() == .alertFirstButtonReturn { copyPhoneAddress() }
    }
    @objc private func openPreviousAddress() {
        NSWorkspace.shared.open(URL(string: "http://127.0.0.1:\(port)/")!)
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        lanAddresses = localAddresses()
        let menu = NSMenu(), item = NSMenuItem(), submenu = NSMenu()
        menu.addItem(item); item.submenu = submenu
        submenu.addItem(withTitle: "iPhone用アドレスを表示", action: #selector(showPhoneAddress), keyEquivalent: "i")
        submenu.addItem(withTitle: "iPhone用アドレスをコピー", action: #selector(copyPhoneAddress), keyEquivalent: "")
        submenu.addItem(withTitle: "以前のローカルアドレスで開く", action: #selector(openPreviousAddress), keyEquivalent: "")
        submenu.addItem(.separator())
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
            let addresses = ["127.0.0.1"] + lanAddresses
            for address in addresses {
                let parameters = NWParameters.tcp
                parameters.allowLocalEndpointReuse = true
                parameters.requiredLocalEndpoint = .hostPort(
                    host: NWEndpoint.Host(address), port: NWEndpoint.Port(rawValue: port)!)
                let server = try NWListener(using: parameters)
                listeners.append(server)
                server.newConnectionHandler = { [weak self] conn in self?.accept(conn) }
                server.stateUpdateHandler = { [weak self] state in
                    guard let self = self else { return }
                    switch state {
                    case .ready:
                        self.readyListeners += 1
                        if self.readyListeners == self.listeners.count && !self.ready {
                            self.ready = true
                            self.openBrowser()
                        }
                    case .failed(let error):
                        self.fail("アドレス " + address + ":\(self.port) を利用できません。\n" +
                                  error.localizedDescription)
                    default: break
                    }
                }
            }
            for server in listeners { server.start(queue: .main) }
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
                let allowedHosts = Set((["127.0.0.1", "localhost"] + self.lanAddresses).map {
                    $0 + ":\(self.port)"
                })
                let hosts = lines.dropFirst().filter { $0.lowercased().hasPrefix("host:") }
                let host = hosts.count == 1 && allowedHosts.contains(
                    String(hosts[0].dropFirst(5)).trimmingCharacters(in: .whitespaces).lowercased())

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
