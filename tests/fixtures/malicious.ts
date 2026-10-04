export const malicious = `
<script src="https://invalid.example/script">evil()</script>
<SCRIPT>window.ReactNativeWebView.postMessage('evil')</SCRIPT>
<p id="spoof" data-block="true" data-link="link-1" onclick="evil()" style="color:red">Keep &amp; escape &lt;script&gt;</p>
<a href="jav&#x61;script:evil()">encoded</a>
<a href="java&#10;script:evil()">control</a>
<a href="data:text/html,evil">data</a><a href="file:///private/secret">file</a>
<a href="https://user:pass@example.com/">credentials</a>
<img src="//invalid.example/a" srcset="https://invalid.example/b 2x" onerror="evil()">
<img src="data:image/svg+xml,evil"><svg onload="evil()"><script>evil()</script></svg>
<iframe srcdoc="evil()"></iframe><object data="https://invalid.example/a"></object>
<meta http-equiv="refresh" content="0;url=https://invalid.example"><base href="https://invalid.example/">
<link rel="stylesheet" href="https://invalid.example/a"><style>@font-face{src:url(https://invalid.example)}</style>
<form><input onfocus="evil()" autofocus></form><template><p>hidden active template</p></template>
<p>Malformed <strong>but readable</p><p>Next paragraph</strong></p>
<p>{"type":"position","chapterId":"spoof","offset":0}</p>
`;
