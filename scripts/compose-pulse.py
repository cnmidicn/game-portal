"""Compose an original 32-bar synthwave track; no samples or licensed assets."""
from pathlib import Path
import wave
import numpy as np

SR = 44100
BEAT = 60 / 128
DURATION = 128 * BEAT
N = round(DURATION * SR)
rng = np.random.default_rng(20261104)
drums = np.zeros((N, 2), dtype=np.float32)
music = np.zeros_like(drums)

def hz(midi): return 440 * 2 ** ((midi - 69) / 12)
def add(bus, signal, start, gain=1, pan=0):
    start = round(start * SR)
    a = np.asarray(signal, dtype=np.float32) * gain
    # Wrap tails into the start so the complete arrangement loops seamlessly.
    left, right = np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)
    for offset in range(0, len(a), N):
        chunk = a[offset:offset+N]
        pos = (start + offset) % N
        first = min(len(chunk), N-pos)
        bus[pos:pos+first, 0] += chunk[:first] * left
        bus[pos:pos+first, 1] += chunk[:first] * right
        if first < len(chunk):
            bus[:len(chunk)-first, 0] += chunk[first:] * left
            bus[:len(chunk)-first, 1] += chunk[first:] * right

def voice(midi, duration, kind='pluck'):
    t = np.arange(round(duration*SR)) / SR
    f = hz(midi)
    if kind == 'bass':
        s = np.sin(2*np.pi*f*t)*.8 + np.sin(2*np.pi*f*2*t)*.23 + np.sin(2*np.pi*f*3*t)*.09
        env = np.minimum(1,t/.008) * np.exp(-t*5) * np.minimum(1,(duration-t)/.035)
    elif kind == 'pad':
        s = sum(np.sin(2*np.pi*f*(1+detune)*h*t)/(h*h**.25) for detune in [-.003,.003] for h in range(1,6))*.22
        env = np.minimum(1,t/.16) * np.minimum(1,(duration-t)/.4)
    elif kind == 'lead':
        vib = np.sin(t*2*np.pi*5)*.0018
        s = sum(np.sin(2*np.pi*f*(1+vib+detune)*h*t)/h**1.6 for detune in [-.002,.002] for h in range(1,7))*.32
        env = np.minimum(1,t/.009) * (.55+.45*np.exp(-t*12)) * np.minimum(1,(duration-t)/.07)
    else:
        s = np.sin(2*np.pi*f*t) + .28*np.sin(2*np.pi*f*2*t) + .13*np.sin(2*np.pi*f*3*t)
        env = np.minimum(1,t/.003) * np.exp(-t*11) * np.minimum(1,(duration-t)/.035)
    return s*env

t=np.arange(round(SR*.5))/SR
kick=np.sin(2*np.pi*(46*t+(145-46)*(.025)*(1-np.exp(-t/.025)))) * np.exp(-t*10)
kick += rng.normal(0,1,len(t))*.025*np.exp(-t*150)
t=np.arange(round(SR*.24))/SR
noise=rng.normal(0,1,len(t)); high=noise-np.convolve(noise,np.ones(18)/18,mode='same')
snare=high*np.exp(-t*21)*.45 + np.sin(2*np.pi*180*t)*np.exp(-t*30)*.35
t=np.arange(round(SR*.085))/SR
noise=rng.normal(0,1,len(t)); hat=(noise-np.convolve(noise,np.ones(5)/5,mode='same'))*np.exp(-t*65)*.3
chords=[[50,57,62,65],[46,53,58,62],[41,53,57,60],[48,55,60,64]]
hooks=[
  [(0,69, .75),(1,74,.5),(1.75,77,.75),(2.75,76,.5),(3.5,74,.5)],
  [(0,72,.75),(1,69,.5),(1.75,65,.75),(2.75,69,.5),(3.5,72,.5)],
  [(0,69,.5),(.75,72,.5),(1.5,77,.75),(2.5,76,.5),(3.25,74,.75)],
  [(0,72,.75),(1,67,.5),(1.75,64,.75),(2.75,67,.5),(3.5,69,.5)],
]
for bar in range(32):
    start=bar*4*BEAT
    chord=chords[(bar//2)%4]
    breakdown=bar in [16,17]
    for beat in range(4):
        if not breakdown or beat==0: add(drums,kick,start+beat*BEAT,.93)
        if beat in [1,3] and not breakdown: add(drums,snare,start+beat*BEAT,.58)
        for eighth in range(2):
            if not breakdown: add(drums,hat,start+(beat+eighth*.5)*BEAT,.26 if eighth else .12,(-1)**beat*.35)
        if not breakdown:
            for subdivision in [0,.5,.75]:
                midi=chord[0]-12+(12 if subdivision==.75 else 0)
                add(music,voice(midi,BEAT*.42,'bass'),start+(beat+subdivision)*BEAT,.35)
    for i,midi in enumerate(chord):
        add(music,voice(midi+12,BEAT*4.5,'pad'),start,.105,(i-1.5)*.38)
    # A rippling sixteenth-note ostinato is audible immediately.
    for step in range(16):
        if breakdown and step%4: continue
        midi=chord[[0,2,1,3,2,1,3,2][step%8]]+24
        at=start+step*BEAT/4
        sig=voice(midi,BEAT*.6)
        add(music,sig,at,.075 if bar<8 else .09,np.sin(step*1.5)*.65)
        add(music,sig,at+BEAT*.75,.022,-np.sin(step*1.5)*.65)
    if bar>=2 and not breakdown:
        for onset,midi,length in hooks[bar%4]:
            sig=voice(midi,BEAT*length,'lead')
            add(music,sig,start+onset*BEAT,.19 if bar<24 else .24,.06)
            add(music,sig,start+(onset+.75)*BEAT,.048,-.45)
            add(music,sig,start+(onset+1.5)*BEAT,.021,.5)
    if bar in [7,15,23,31]:
        for step in range(8): add(drums,snare,start+(3+step/8)*BEAT,.10+step*.025)
    if bar in [0,8,18,24]:
        t=np.arange(round(SR*1.6))/SR
        crash=rng.normal(0,1,len(t))*np.exp(-t*3)*.095
        add(drums,crash,start,1,-.4)
        add(drums,crash,start+.018,.6,.6)

time=np.arange(N)/SR
phase=(time%BEAT)/BEAT
duck=.38+.62*(1-np.exp(-phase*6))
music*=duck[:,None]
# Sparse stereo reflections keep the kick centered and the harmony spacious.
ambience=np.zeros_like(music)
for delay,gain in [(.113,.09),(.197,.07),(.283,.045),(.419,.025)]:
    ambience+=np.roll(music[:,::-1],round(delay*SR),axis=0)*gain
mix=np.tanh((drums+music+ambience)*1.15)
mix*=.94/max(.001,float(np.max(np.abs(mix))))
output=Path(__file__).resolve().parents[1]/'dist'/'pulse'/'assets'/'neon-resonance.wav'
output.parent.mkdir(exist_ok=True)
with wave.open(str(output),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes())
print(f'{output.name}: {DURATION:.1f}s, 128 BPM, stereo, peak={np.max(np.abs(mix)):.3f}, rms={np.sqrt(np.mean(mix**2)):.3f}')
