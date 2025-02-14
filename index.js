const { app, BrowserWindow, globalShortcut } = require('electron')
const fs = require('fs')
const path = require('path')

const getTipsOpacity = () => app.config.getConfig().tips.opacity || '0.3'
const getTipsPath = () => app.config.getConfig().tips.path || path.join(process.env['HOME'], '.hyper-tips')
const getContent = () => fs.readFileSync(getTipsPath()).toString().split('\n')
const getKey = () => app.config.getConfig().tips.toggleKey || 'cmd+alt+t'

const toggleTips = () => {
    const w = BrowserWindow.getFocusedWindow()
    if (!w) return
    w.webContents.executeJavaScript(`{
        var x = document.getElementById("tips");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
    }`)
}

exports.decorateConfig = (config) => {
    return Object.assign({}, config, {
        css: `
            ${config.css || ''}
            .tips {
                display: none;
                position: fixed;
                top: 50px;
                bottom: 50px;
                right: 0px;
                width: 30%;
                font-size: 2vmin;
                opacity: ${getTipsOpacity()};
                overflow-wrap: break-word;
            }
            .tips span::before {
                content: "";
                display: block;
            }
        `
    });
};


exports.decorateHyper = (Hyper, { React }) => {
    class Tips extends React.Component {
        constructor(props, context) {
            super(props, context)
        }
        render() {
            let content = this.props.content || []
            return (
                React.createElement(Hyper, Object.assign({}, this.props, {
                    customChildren: React.createElement(
                        'div',
                        { id: 'tips', className: 'tips' },
                        content.map(elem => React.createElement('span', { className: 'tip-line' }, elem))
                    )
                }))
            )
        }
    }
    return Tips
}

exports.reduceUI = (state, action) => {
    switch (action.type) {
      case 'TIPS:CONTENT': {
        return state.set('content', action.content)
      } 
    }
    return state
}

exports.mapHyperState = (state, map) => {
    return Object.assign(map, {
        content: state.ui.content
    })
}

function windowOptionsAwaiter(mode, object, fn) {
    switch (mode) {
        case 'rpc': {
            if ('rpc' in object && object['rpc'].id) {
                fn(object['rpc'])
                return
            } else {
                setTimeout(() => windowOptionsAwaiter('rpc', object, fn), 10)
            }
            return
        }
        case 'store': {
            if ('store' in object && object['store']) {
                fn(object['store'])
                return
            } else {
                setTimeout(() => windowOptionsAwaiter('store', object, fn), 10)
            }
            return
        }
    }
}

exports.onWindow = (window) => {
    window.rpc.on('tips:renderer_win_ready', () => {
        window.rpc.emit('tips:content', {content: getContent()})
    })
}

exports.onRendererWindow = (window) => {
    windowOptionsAwaiter('rpc', window, rpc => {
        rpc.emit('tips:renderer_win_ready', {})
        rpc.on('tips:content', (message) => {
            windowOptionsAwaiter('store', window, store => {
                store.dispatch({
                    type: 'TIPS:CONTENT',
                    content: message.content
                })
            })
        })
    })
}

exports.onApp = (a) => {
    globalShortcut.register(getKey(), toggleTips)
}

exports.onUnload = () => {
    globalShortcut.unregister(getKey())
}