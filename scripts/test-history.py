#!/usr/bin/env python3
"""Test undo/redo through Firefox using Marionette; no Python dependencies.

Run directly to start a temporary headless Firefox, or pass --port to use an
existing Firefox started with --headless --marionette and a temporary profile.
"""
import argparse
import json
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
STORAGE = 'seal-loop-pid-v1'


class Browser:
    def __init__(self, port):
        self.socket = socket.create_connection(('127.0.0.1', port), timeout=10)
        self.sequence = 0
        self.read()

    def read(self):
        prefix = b''
        while not prefix.endswith(b':'):
            chunk = self.socket.recv(1)
            if not chunk:
                raise RuntimeError('Browser connection closed')
            prefix += chunk
        length = int(prefix[:-1])
        data = b''
        while len(data) < length:
            chunk = self.socket.recv(length - len(data))
            if not chunk:
                raise RuntimeError('Browser connection closed')
            data += chunk
        return json.loads(data)

    def call(self, name, args=None):
        self.sequence += 1
        data = json.dumps([0, self.sequence, name, args or {}]).encode()
        self.socket.sendall(str(len(data)).encode() + b':' + data)
        result = self.read()
        if result[2]:
            raise RuntimeError(result[2])
        return result[3]

    def js(self, script, args=None):
        return self.call('WebDriver:ExecuteScript', {
            'script': script, 'args': args or [], 'newSandbox': False,
        })['value']

    def async_js(self, script, args=None):
        return self.call('WebDriver:ExecuteAsyncScript', {
            'script': script, 'args': args or [],
        })['value']


def run_tests(browser):
    b = browser
    url = (ROOT / 'PID-Builder.html').as_uri()
    b.call('WebDriver:Navigate', {'url': url})
    b.js('localStorage.clear();return true')
    b.call('WebDriver:Navigate', {'url': url})

    def state():
        return b.js(f"return JSON.parse(localStorage.getItem('{STORAGE}'))")

    def click(element_id):
        b.js('document.getElementById(arguments[0]).click();return true', [element_id])

    def select(index):
        b.js('''const n=document.querySelectorAll('#nodes>.node')[arguments[0]],p=new DOMPoint(0,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''', [index])

    def add(kind):
        b.js('document.querySelector(`[data-kind="${arguments[0]}"]`).click();return true', [kind])

    def roundtrip(action, label):
        before = state()
        action()
        after = state()
        assert after != before, label + ': action did not change the drawing'
        click('undo')
        assert state() == before, label + ': undo mismatch'
        click('redo')
        assert state() == after, label + ': redo mismatch'
        print('PASS:', label, flush=True)

    def edit(field, values):
        b.js('''for(const value of arguments[1]){const input=document.getElementById(arguments[0]);input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}return true;''', [field, values])

    def load(project):
        b.async_js('''const done=arguments[arguments.length-1],input=document.getElementById('projectFile'),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(arguments[0])],'test.json',{type:'application/json'}));input.files=dt.files;input.onchange({target:input}).then(()=>done(true));''', [project])

    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")
    def drop_symbol(x, y, alt=False):
        b.js('''const svg=document.getElementById('drawing'),p=new DOMPoint(arguments[0],arguments[1]).matrixTransform(svg.getScreenCTM()),dt=new DataTransfer();dt.setData('text/plain','PI');document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,altKey:arguments[2],cancelable:true}));return true;''', [x, y, alt])

    def drag_symbol(x, y, alt=False):
        b.js('''const n=document.querySelector('#nodes>.node'),svg=document.getElementById('drawing'),from=new DOMPoint(0,0).matrixTransform(n.getScreenCTM()),to=new DOMPoint(arguments[0],arguments[1]).matrixTransform(svg.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:from.x,clientY:from.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:to.x,clientY:to.y,altKey:arguments[2]}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''', [x, y, alt])

    empty_project = dict(title='Snap fixture', nodes=[], pipes=[], nextId=1, sealSvg=None, portModeVersion=3)
    junction_ports = [dict(id='L', x=-22, y=0), dict(id='R', x=22, y=0), dict(id='T', x=0, y=-22), dict(id='B', x=0, y=22)]
    legacy_project = dict(title='Legacy ports', nodes=[
        dict(id='n0', kind='seal', x=150, y=300, w=455, h=500, tag='SEAL', notes='', ports=[dict(id='T1', x=-125, y=-236)]),
        dict(id='n1', kind='PI', x=450, y=300, w=90, h=90, tag='PI', notes='', ports=[dict(id='R', x=45, y=0)]),
        dict(id='n2', kind='junction', x=750, y=300, w=44, h=44, tag='', notes='', ports=junction_ports),
        dict(id='n3', kind='junction', x=1050, y=300, w=44, h=44, tag='', notes='', ports=junction_ports),
    ], pipes=[
        dict(id='n4', a=dict(node='n0', port='T1'), b=dict(node='n2', port='L')),
        dict(id='n5', a=dict(node='n1', port='R'), b=dict(node='n2', port='T')),
        dict(id='n6', a=dict(node='n2', port='R'), b=dict(node='n3', port='L')),
    ], nextId=7, sealSvg=None)
    b.js(f"localStorage.setItem('{STORAGE}',JSON.stringify(arguments[0]));return true", [legacy_project])
    b.call('WebDriver:Navigate', {'url': url})
    migrated = state()
    assert migrated['portModeVersion'] == 3 and all(not node['ports'] for node in migrated['nodes'])
    assert not migrated['pipes']
    assert b.js("return JSON.parse(localStorage.getItem('seal-loop-pid-v1-before-all-manual-ports'))") == legacy_project
    load(legacy_project)
    assert not state()['pipes']
    load(dict(legacy_project, portModeVersion=2))
    assert not state()['pipes'] and state()['nodes'][0]['ports'] and state()['nodes'][1]['ports']
    assert not state()['nodes'][2]['ports'] and not state()['nodes'][3]['ports']
    load(dict(legacy_project, portModeVersion=3))
    assert len(state()['pipes']) == 3 and all(node['ports'] for node in state()['nodes'])
    roundtrip(lambda: b.js("""document.querySelector('[data-node="n1"][data-port="R"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,altKey:true}));return true"""), 'remove connected instrument port and pipe')
    assert len(state()['pipes']) == 2 and not state()['nodes'][1]['ports']
    select(0)
    assert b.js("const button=document.querySelector('[data-remove-port=\"T1\"]'),panel=document.querySelector('.inspector');return button&&button.getBoundingClientRect().bottom<=panel.getBoundingClientRect().bottom")
    roundtrip(lambda: b.js("""document.querySelector('[data-remove-port="T1"]').click();return true"""), 'remove connected seal port from Properties')
    assert len(state()['pipes']) == 1 and not state()['nodes'][0]['ports']
    pump_project = dict(title='Manual pump port', nodes=[dict(id='n0', kind='circulating-pump', x=400, y=400, w=190, h=190, tag='PUMP', notes='', ports=[dict(id='P1', x=10, y=-30, custom=True)], artworkSource='media', artworkVersion='older-art')], pipes=[], nextId=1, sealSvg=None, portModeVersion=3)
    load(pump_project)
    assert [port['id'] for port in state()['nodes'][0]['ports']] == ['P1']
    load(empty_project)
    print('PASS: migrate old symbol ports and preserve current manual ports', flush=True)
    click('snapGrid')
    assert b.js("return document.getElementById('snapGrid').getAttribute('aria-pressed')") == 'true'
    assert b.js("return document.getElementById('undo').disabled")
    b.call('WebDriver:Navigate', {'url': url})
    assert b.js("return document.getElementById('snapGrid').getAttribute('aria-pressed')") == 'true'
    drop_symbol(123, 137)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (125, 125)
    drag_symbol(242, 263)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (250, 275)
    drag_symbol(237, 258, True)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (237, 258)
    click('duplicateSelected')
    assert (state()['nodes'][1]['x'], state()['nodes'][1]['y']) == (275, 300)
    ports = [dict(id='L', x=-22, y=0), dict(id='R', x=22, y=0), dict(id='T', x=0, y=-22), dict(id='B', x=0, y=22)]
    air_fixture = dict(title='Off-grid pipe', nodes=[
        dict(id='n0', kind='PI', x=100, y=100, w=90, h=90, tag='PI', notes='', ports=[dict(id='L', x=-45, y=0), dict(id='R', x=45, y=0)]),
        dict(id='n1', kind='junction', x=200, y=413, w=44, h=44, tag='', notes='', ports=ports),
        dict(id='n2', kind='junction', x=800, y=413, w=44, h=44, tag='', notes='', ports=ports),
    ], pipes=[dict(id='n3', a=dict(node='n1', port='R'), b=dict(node='n2', port='L'))], nextId=4, sealSvg=None, portModeVersion=3)
    load(air_fixture)
    drag_symbol(450, 413)
    assert state()['nodes'][0]['y'] == 413 and len(state()['pipes']) == 2
    load(air_fixture)
    b.js('''const svg=document.getElementById('drawing'),p=new DOMPoint(450,413).matrixTransform(svg.getScreenCTM()),dt=new DataTransfer();dt.setData('text/plain','junction');document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,cancelable:true}));return true;''')
    assert len(state()['pipes']) == 2 and len(state()['nodes'][-1]['ports']) == 4
    load(empty_project)
    drop_symbol(123, 137, True)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (123, 137)
    load(empty_project)
    click('snapGrid')
    assert b.js("return document.getElementById('snapGrid').getAttribute('aria-pressed')") == 'false'
    drop_symbol(123, 137)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (123, 137)
    load(empty_project)
    print('PASS: optional 25-unit symbol snapping, Alt bypass, and saved preference', flush=True)
    add('circulating-pump')
    assert state()['nodes'][0]['ports'] == []
    def add_equipment_port():
        select(0)
        click('addPortHere')
        b.js('''const n=document.querySelector('#nodes>.node'),p=new DOMPoint(0,-20).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));return true;''')
    roundtrip(add_equipment_port, 'add manual equipment port')
    assert [port['id'] for port in state()['nodes'][0]['ports']] == ['P1']
    click('undo')
    click('undo')
    roundtrip(lambda: add('PI'), 'add symbol / redo')
    assert state()['nodes'][0]['ports'] == []
    def add_instrument_port():
        select(0)
        click('addPortHere')
        b.js('''const n=document.querySelector('#nodes>.node'),p=new DOMPoint(45,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));return true;''')
    roundtrip(add_instrument_port, 'add manual instrument port')
    assert [port['id'] for port in state()['nodes'][0]['ports']] == ['P1']
    roundtrip(lambda: b.js('document.querySelector("[data-port=P1]").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,altKey:true}));return true'), 'remove manual instrument port')
    select(0)
    roundtrip(lambda: edit('tagEdit', ['P', 'PI-', 'PI-101']), 'caption typing grouped into one edit')
    select(0)
    roundtrip(lambda: edit('notesEdit', ['N', 'Notes', 'Notes for PI']), 'notes typing grouped into one edit')
    b.js('document.activeElement.blur();return true')
    b.js('document.getElementById("drawing").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX:300,clientY:200}));window.dispatchEvent(new PointerEvent("pointerup"));return true')
    roundtrip(lambda: edit('titleEdit', ['S', 'Seal', 'Seal support loop']), 'drawing title typing grouped into one edit')
    select(0)
    for element_id in ['rotateRight', 'mirrorHorizontal', 'mirrorVertical', 'resetTransform', 'duplicateSelected']:
        select(0)
        roundtrip(lambda element_id=element_id: click(element_id), element_id)
    select(0)
    roundtrip(lambda: b.js('const i=document.getElementById("symbolScale");i.value=150;i.dispatchEvent(new Event("change"));return true'), 'resize')

    def move():
        b.js('''const n=document.querySelector('#nodes>.node'),p=new DOMPoint(0,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));for(let i=1;i<=5;i++)window.dispatchEvent(new PointerEvent('pointermove',{clientX:p.x+i*20,clientY:p.y+i*10}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(move, 'multi-move drag is one edit')

    nodes = [dict(id=f'n{i}', kind='junction', x=250+i*800, y=400, w=44, h=44,
                  tag='', notes='', ports=[dict(id='L', x=-22, y=0), dict(id='R', x=22, y=0),
                                          dict(id='T', x=0, y=-22), dict(id='B', x=0, y=22)])
             for i in range(2)]
    fixture = dict(title='History fixture', nodes=nodes, pipes=[], nextId=10, sealSvg=None, portModeVersion=3)
    load(fixture)
    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")

    def connect():
        b.js('''for(const ref of [[0,'R'],[1,'L']]){const n=document.querySelectorAll('#nodes>.node')[ref[0]],p=n.querySelector('[data-port='+ref[1]+']'),q=new DOMPoint(0,0).matrixTransform(p.getScreenCTM());p.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:q.x,clientY:q.y}));}return true;''')
    roundtrip(connect, 'connect ports')

    def select_pipe():
        b.js("document.querySelector('[data-pipe]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return true")
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-color=orange]').click();return true"), 'line color')
    assert b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('stroke-dasharray')") is None
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-service=instrument-air]').click();return true"), 'dashed instrument air')
    assert state()['pipes'][0]['service'] == 'instrument-air'
    assert b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('stroke-dasharray')") == '9 6'
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-service=process]').click();return true"), 'restore solid pipe')
    assert 'service' not in state()['pipes'][0]
    assert b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('stroke-dasharray')") is None
    select_pipe()
    b.js("document.querySelector('[data-pipe-service=instrument-air]').click();return true")
    exported_dash = b.async_js('''const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>done(new DOMParser().parseFromString(markup,'image/svg+xml').querySelector('#pipes .wire')?.getAttribute('stroke-dasharray')));return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;''')
    assert exported_dash == '9 6'
    assert not b.js("return !!document.querySelector('#pipes .flow-arrow')")
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-direction=forward]').click();return true"), 'forward flow direction')
    assert state()['pipes'][0]['direction'] == 'forward'
    assert b.js("return document.querySelector('#pipes .flow-arrow').getAttribute('fill')") == '#ea580c'
    forward_arrow = b.js("return document.querySelector('#pipes .flow-arrow').getAttribute('d')")
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-direction=reverse]').click();return true"), 'reverse flow direction')
    reverse_arrow = b.js("return document.querySelector('#pipes .flow-arrow').getAttribute('d')")
    assert reverse_arrow != forward_arrow
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-direction=none]').click();return true"), 'clear flow direction')
    assert 'direction' not in state()['pipes'][0]
    assert not b.js("return !!document.querySelector('#pipes .flow-arrow')")
    select_pipe()
    b.js("document.querySelector('[data-pipe-direction=forward]').click();return true")
    for element_id in ['routeHorizontal', 'routeVertical']:
        select_pipe()
        roundtrip(lambda element_id=element_id: click(element_id), element_id)

    def route_drag():
        select_pipe()
        b.js('''const h=document.querySelector('.bend-handle circle'),p=new DOMPoint(Number(h.getAttribute('cx')),Number(h.getAttribute('cy'))).matrixTransform(document.getElementById('drawing').getScreenCTM());h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));for(let i=1;i<=4;i++)window.dispatchEvent(new PointerEvent('pointermove',{clientX:p.x+i*20,clientY:p.y}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(route_drag, 'bend drag grouped into one edit')
    select_pipe()
    roundtrip(lambda: click('routeCenter'), 'recenter route')
    select_pipe()
    roundtrip(lambda: click('routeAdd'), 'add first pipe waypoint')
    assert len(state()['pipes'][0]['route']['waypoints']) == 1
    select_pipe()
    roundtrip(lambda: click('routeAdd'), 'add second pipe waypoint')
    assert len(state()['pipes'][0]['route']['waypoints']) == 2

    def move_waypoint():
        select_pipe()
        b.js('''const h=document.querySelector('.waypoint-handle circle'),svg=document.getElementById('drawing'),p=new DOMPoint(Number(h.getAttribute('cx')),Number(h.getAttribute('cy'))).matrixTransform(svg.getScreenCTM());h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:p.x,clientY:p.y-80}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(move_waypoint, 'waypoint drag grouped into one edit')
    assert state()['pipes'][0]['route']['waypoints'][0]['y'] < 400
    assert b.js('''const points=document.querySelector('#pipes .wire:not(.hit)').getAttribute('d').match(/-?\\d+(?:\\.\\d+)?/g).map(Number);for(let i=2;i<points.length;i+=2)if(points[i]!==points[i-2]&&points[i+1]!==points[i-1])return false;return true;''')
    visible_route = b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('d')")
    exported_route = b.async_js('''const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>{const doc=new DOMParser().parseFromString(markup,'image/svg+xml');done([doc.querySelector('#pipes .wire').getAttribute('d'),doc.querySelectorAll('.waypoint-handle').length])});return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;''')
    assert exported_route == [visible_route, 0]

    def remove_waypoint():
        select_pipe()
        b.js("document.querySelector('[data-waypoint=\"1\"] circle').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,altKey:true}));return true")
    roundtrip(remove_waypoint, 'remove a pipe waypoint')
    assert len(state()['pipes'][0]['route']['waypoints']) == 1
    before_move = state()
    move()
    assert state()['pipes'][0]['route']['waypoints'] == before_move['pipes'][0]['route']['waypoints']
    click('undo')
    assert state() == before_move
    select(0)
    roundtrip(lambda: click('deleteSelected'), 'delete symbol restores its connected pipes')
    click('undo')
    select_pipe()
    roundtrip(lambda: click('deleteSelected'), 'delete pipe')
    click('undo')

    def insert():
        b.js('''const dt=new DataTransfer();document.querySelector('[data-kind=PI]').dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt}));const p=new DOMPoint(450,400).matrixTransform(document.getElementById('drawing').getScreenCTM());document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,cancelable:true}));return true;''')
    roundtrip(insert, 'palette insertion is one edit including colored, directed, dashed connections')
    assert len(state()['pipes']) == 2 and all(p['color'] == 'orange' and p['direction'] == 'forward' and p['service'] == 'instrument-air' for p in state()['pipes'])
    assert any(p['route'].get('waypoints') for p in state()['pipes'])

    # Move an existing unconnected instrument into the remaining line section.
    add('TI')
    instrument_index = len(state()['nodes']) - 1
    def insert_existing():
        line_y = state()['pipes'][1]['route']['waypoints'][-1]['y']
        b.js("""const n=document.querySelectorAll('#nodes>.node')[arguments[0]],svg=document.getElementById('drawing'),from=new DOMPoint(0,0).matrixTransform(n.getScreenCTM()),to=new DOMPoint(900,arguments[1]).matrixTransform(svg.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:from.x,clientY:from.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:to.x,clientY:to.y}));window.dispatchEvent(new PointerEvent('pointerup'));return true;""", [instrument_index, line_y])
    roundtrip(insert_existing, 'existing instrument insertion is one edit')
    assert len(state()['pipes']) == 3

    roundtrip(lambda: add('dual-seal-bb-w-plug'), 'add seal')
    seal_index = len(state()['nodes']) - 1
    assert state()['nodes'][seal_index]['ports'] == []

    def add_port():
        select(seal_index)
        click('addPortHere')
        b.js('''const n=document.querySelectorAll('#nodes>.node')[arguments[0]],p=new DOMPoint(20,30).matrixTransform(n.getScreenCTM());n.querySelector('image').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));return true;''', [seal_index])
    roundtrip(add_port, 'add custom seal port')
    roundtrip(lambda: b.js('document.querySelector("[data-port=P1]").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,altKey:true}));return true'), 'remove custom seal port')

    def import_svg():
        b.async_js('''const done=arguments[arguments.length-1],input=document.getElementById('sealFile'),dt=new DataTransfer();dt.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50"/></svg>'],'custom.svg',{type:'image/svg+xml'}));input.files=dt.files;input.onchange({target:input}).then(()=>done(true));''')
    select(seal_index)
    roundtrip(import_svg, 'replace imported SVG')
    b.js('document.getElementById("drawing").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX:300,clientY:200}));window.dispatchEvent(new PointerEvent("pointerup"));return true')
    roundtrip(import_svg, 'import new SVG is one edit')

    # Branching history clears redo. Selection, pan, and zoom do not create edits.
    click('undo')
    assert not b.js("return document.getElementById('redo').disabled")
    add('TI')
    assert b.js("return document.getElementById('redo').disabled")
    expected = state()
    select(0)
    b.js('const svg=document.getElementById("drawing");svg.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX:300,clientY:200}));window.dispatchEvent(new PointerEvent("pointermove",{clientX:320,clientY:210}));window.dispatchEvent(new PointerEvent("pointerup"));return true')
    click('zoomIn')
    click('zoomOut')
    assert state() == expected
    click('undo')
    assert len(state()['nodes']) == len(expected['nodes']) - 1
    click('redo')
    assert state() == expected
    print('PASS: redo invalidation and no history entries for selection / pan / zoom')

    # Shortcuts work outside text inputs and leave focused inputs to the browser.
    before = state()
    b.js('document.activeElement.blur();window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));return true')
    assert state() != before
    b.js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));return true')
    assert state() == before
    b.js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent("keydown",{key:"y",ctrlKey:true,bubbles:true,cancelable:true}));return true')
    assert state() == before
    b.js('document.getElementById("titleEdit").focus();window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));return true')
    assert state() == before
    print('PASS: Ctrl/Cmd shortcuts and native text-field shortcut protection')

    b.call('WebDriver:Navigate', {'url': url})
    assert state() == before
    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")
    add('PT')
    b.js('window.confirm=()=>true;document.getElementById("newProject").click();return true')
    assert not state()['nodes'] and b.js("return document.getElementById('undo').disabled")
    # Cap session history without breaking nextId restoration.
    b.js('for(let i=0;i<105;i++)document.querySelector("[data-kind=PI]").click();return true')
    b.js('for(let i=0;i<100;i++)document.getElementById("undo").click();return true')
    assert len(state()['nodes']) == 5 and b.js("return document.getElementById('undo').disabled")
    b.js('for(let i=0;i<100;i++)document.getElementById("redo").click();return true')
    assert len(state()['nodes']) == 105 and b.js("return document.getElementById('redo').disabled")
    print('PASS: reload / new / open history reset, autosave, and 100-edit history limit')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, help='Connect to an existing temporary Firefox')
    args = parser.parse_args()
    process = None
    b = None
    with tempfile.TemporaryDirectory(prefix='pid-history-') as profile:
        try:
            port = args.port
            if port is None:
                firefox = shutil.which('firefox')
                if not firefox:
                    raise RuntimeError('Firefox is required to run this test')
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0))
                    port = sock.getsockname()[1]
                Path(profile, 'user.js').write_text(f'user_pref("marionette.port", {port});\n')
                process = subprocess.Popen([firefox, '--headless', '--marionette', '--no-remote', '--profile', profile],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + 20
            while True:
                try:
                    b = Browser(port)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(.2)
            b.call('WebDriver:NewSession')
            b.call('WebDriver:SetWindowRect', {'width': 1440, 'height': 1000})
            run_tests(b)
        finally:
            if b:
                try:
                    b.call('WebDriver:DeleteSession')
                finally:
                    b.socket.close()
            if process:
                process.terminate()
                process.wait(timeout=10)


if __name__ == '__main__':
    main()
