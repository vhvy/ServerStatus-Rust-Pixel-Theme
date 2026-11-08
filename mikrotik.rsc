:local apiBase ""
:local nodeName ""
:local nodePassword ""
:local checkCertificate "yes"
# Select WAN interfaces only. Do not count ether1 and its PPPoE/VLAN together.
:local interfaces {"pppoe-out1"}
# ICMP reachability probes. Set either address to "" to disable that family.
:local probe4 "223.5.5.5"
:local probe6 "2400:3200::1"
# Guangdong carrier DNS addresses for ICMP latency probes.
# RouterOS measures ICMP RTT; the Rust client measures TCP connect time on port 80.
:local carrierCU "210.21.196.6"
:local carrierCT "202.96.128.86"
:local carrierCM "211.136.192.6"
:local verbose false

:if ([/system script job print count-only where script=[:jobname]] > 1) do={ :return 0 }
:if ([:len $apiBase] = 0 || [:len $nodeName] = 0 || [:len $nodePassword] = 0 || $nodePassword = "CHANGE_ME") do={
    :error "serverstatus: configure apiBase, nodeName and nodePassword"
}
:while ([:len $apiBase] > 0 && [:pick $apiBase ([:len $apiBase] - 1)] = "/") do={
    :set apiBase [:pick $apiBase 0 ([:len $apiBase] - 1)]
}
:if ([:len $apiBase] = 0) do={ :error "serverstatus: empty apiBase" }
:local reportUrl ($apiBase . "/report")

:local memTotal [/system resource get total-memory]
:local memUsed ($memTotal - [/system resource get free-memory])
:local diskTotal 0
:local diskUsed 0
:do {
    :set diskTotal [/system resource get total-hdd-space]
    :set diskUsed ($diskTotal - [/system resource get free-hdd-space])
} on-error={ :log warning "serverstatus: disk statistics unavailable" }
:local uptimeSec ([:tonsec [/system resource get uptime]] / 1000000000)

:local networkRx 0
:local networkTx 0
:local networkIn 0
:local networkOut 0
:local validInterfaces 0
:foreach interfaceName in=$interfaces do={
    :do {
        :local stats [/interface print stats as-value where name=$interfaceName]
        :if ([:len $stats] != 1) do={ :error "interface not found" }
        :local traffic [/interface monitor-traffic $interfaceName once as-value]
        :local rxBytes [:tonum ($stats->0->"rx-byte")]
        :local txBytes [:tonum ($stats->0->"tx-byte")]
        :local rxBits [:tonum ($traffic->"rx-bits-per-second")]
        :local txBits [:tonum ($traffic->"tx-bits-per-second")]
        :if ([:typeof $rxBytes] != "num" || [:typeof $txBytes] != "num" || [:typeof $rxBits] != "num" || [:typeof $txBits] != "num") do={
            :error "invalid interface statistics"
        }
        :set networkIn ($networkIn + $rxBytes)
        :set networkOut ($networkOut + $txBytes)
        :set networkRx ($networkRx + $rxBits / 8)
        :set networkTx ($networkTx + $txBits / 8)
        :set validInterfaces ($validInterfaces + 1)
    } on-error={ :log warning ("serverstatus: cannot read interface " . $interfaceName) }
}
# Do not submit partial counters: this could reset the server's monthly baseline.
:if ($validInterfaces != [:len $interfaces] || $validInterfaces = 0) do={
    :error "serverstatus: check configured WAN interfaces"
}

:local tcpCount 0
:local udpCount 0
:do {
    :set tcpCount [/ip firewall connection print count-only where protocol=tcp]
    :set udpCount [/ip firewall connection print count-only where protocol=udp]
} on-error={ :log warning "serverstatus: connection tracking unavailable" }

:local online4 false
:local online6 false
:if ([:len $probe4] > 0) do={
    :do { :set online4 ([/ping address=$probe4 count=1 interval=1s] > 0) } on-error={}
}
:if ([:len $probe6] > 0) do={
    :do { :set online6 ([/ping address=$probe6 count=1 interval=1s] > 0) } on-error={}
}

# time_* is latency in milliseconds; ping_* is packet loss and stays zero.
# Take one sample per carrier, with a 1s timeout as in the Rust client.
# Keep failed probes at 1000ms so they are not reported as zero-latency replies.
:local carrierLatency do={
    :local latencyMs 1000
    :onerror probeError in={
        # count=1 can return a flat dictionary, not an array of dictionaries.
        :local reply [/ping address=$address count=1 interval=1s as-value]
        :if ([:typeof ($reply->0)] = "array") do={ :set reply ($reply->0) }
        :local replyStatus ($reply->"status")
        :local rtt ($reply->"time")
        :if (([:len $replyStatus] = 0 || $replyStatus = "echo reply") && [:typeof $rtt] = "time") do={
            :set latencyMs ([:tonsec $rtt] / 1000000)
        } else={
            :log warning ("serverstatus: no valid carrier RTT for " . $address . "; result=" . [:tostr $reply])
        }
    } do={ :log warning ("serverstatus: carrier probe failed for " . $address . ": " . $probeError) }
    :return $latencyMs
}
:local timeCU [$carrierLatency address=$carrierCU]
:local timeCT [$carrierLatency address=$carrierCT]
:local timeCM [$carrierLatency address=$carrierCM]

# SysInfo must contain every protobuf-generated field, including empty strings.
:local rosVersion [/system resource get version]
:local sysInfo {
    "name"="routeros-agent"; "version"="1.0";
    "os_name"="RouterOS"; "os_arch"=[/system resource get architecture-name];
    "os_family"="RouterOS"; "os_release"=("RouterOS " . $rosVersion);
    "kernel_version"=$rosVersion; "cpu_num"=[/system resource get cpu-count];
    "cpu_brand"=[/system resource get cpu]; "cpu_vender_id"="";
    "host_name"=[/system identity get name]
}
# HostStat is flat JSON. Memory/swap: KiB; disk: MiB; counters: bytes;
# network_rx/tx: bytes/s; uptime: seconds; cpu: percent (0..100).
# Unsupported load/process/thread and unmeasured packet loss use zero.
:local report {
    "name"=$nodeName; "sys_info"=$sysInfo; "si"=false;
    "online4"=$online4; "online6"=$online6; "notify"=true; "vnstat"=false;
    "uptime"=$uptimeSec; "cpu"=[/system resource get cpu-load];
    "load_1"=0; "load_5"=0; "load_15"=0;
    "ping_10010"=0; "ping_189"=0; "ping_10086"=0;
    "time_10010"=$timeCU; "time_189"=$timeCT; "time_10086"=$timeCM;
    "tcp"=$tcpCount; "udp"=$udpCount; "process"=0; "thread"=0;
    "memory_total"=($memTotal / 1024); "memory_used"=($memUsed / 1024);
    "swap_total"=0; "swap_used"=0;
    "hdd_total"=($diskTotal / 1048576); "hdd_used"=($diskUsed / 1048576);
    "network_rx"=$networkRx; "network_tx"=$networkTx;
    "network_in"=$networkIn; "network_out"=$networkOut
}
:local payload [:serialize to=json options=json.no-string-conversion value=$report]
:onerror uploadError in={
    :local response [/tool fetch url=$reportUrl http-method=post http-data=$payload \
        http-auth-scheme=basic user=$nodeName password=$nodePassword \
        http-header-field="Content-Type:application/json,ssr-auth:single" \
        check-certificate=$checkCertificate idle-timeout=14s duration=15s \
        http-max-redirect-count=0 output=user as-value]
    :if ([:typeof ($response->0)] = "array") do={ :set response ($response->0) }
    :local uploadStatus ($response->"status")
    :if ($uploadStatus != "finished") do={
        :error ("HTTP fetch did not finish; status=" . [:tostr $uploadStatus] . "; result-type=" . [:typeof $response])
    }
    # /report returns HTTP 200 with an empty body, not a JSON-RPC reply.
    :if ($verbose) do={ :log info "serverstatus: HTTP upload completed" }
} do={
    :log warning ("serverstatus: upload failed: " . $uploadError)
}
