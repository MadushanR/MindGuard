$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$directory = Join-Path (Split-Path -Parent $PSScriptRoot) 'artifacts'
[IO.Directory]::CreateDirectory($directory) | Out-Null
$sampleRate = 24000
function New-Silence([int]$Seconds) { return ,(New-Object byte[] ($sampleRate * 2 * $Seconds)) }
function New-SpokenPcm([string]$Text) {
    $stream = New-Object IO.MemoryStream
    $speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo($sampleRate, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
        $speech.SetOutputToAudioStream($stream, $format)
        $speech.Speak($Text)
        $speech.SetOutputToNull()
        return ,$stream.ToArray()
    } finally { $speech.Dispose(); $stream.Dispose() }
}
function Join-Pcm([object[]]$Segments) {
    $stream = New-Object IO.MemoryStream
    try {
        foreach ($segment in $Segments) { $stream.Write($segment, 0, $segment.Length) }
        return ,$stream.ToArray()
    } finally { $stream.Dispose() }
}
function Write-TestWav([string]$Name, [byte[]]$Pcm) {
    $file = [IO.File]::Create((Join-Path $directory $Name))
    $writer = New-Object IO.BinaryWriter($file)
    try {
        $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
        $writer.Write([uint32]($Pcm.Length + 36))
        $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
        $writer.Write([uint32]16)
        $writer.Write([uint16]1)
        $writer.Write([uint16]1)
        $writer.Write([uint32]$sampleRate)
        $writer.Write([uint32]($sampleRate * 2))
        $writer.Write([uint16]2)
        $writer.Write([uint16]16)
        $writer.Write([Text.Encoding]::ASCII.GetBytes('data'))
        $writer.Write([uint32]$Pcm.Length)
        $writer.Write($Pcm)
    } finally { $writer.Dispose(); $file.Dispose() }
}
$ordinary = New-SpokenPcm 'Hello Zen. I had a long day at work. Please give me one short supportive sentence.'
$safety = New-SpokenPcm 'I want to end my life.'
Write-TestWav 'voice-e2e-input.wav' (Join-Pcm @((New-Silence 3), $ordinary, (New-Silence 12), $ordinary, (New-Silence 35)))
Write-TestWav 'voice-e2e-silence.wav' (New-Silence 60)
Write-TestWav 'voice-e2e-safety.wav' (Join-Pcm @((New-Silence 4), $safety, (New-Silence 45)))
Write-Output 'Prepared synthetic microphone fixtures. No user microphone was captured or speech played aloud.'
