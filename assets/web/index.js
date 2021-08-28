//C++ 调用js接口
//信号绑定
// initData(const QString& jsonData); 初始化，参数为json字符串
// void setHtml(const QString& html); 初始化，设置html
// insertVoiceItem(const QString &jsonData);　插入语音，参数为json字符串

//callback回调
// const QString getHtml();获取整个html
// const QString getAllNote();获取所有语音列表的Json
//

// 注册右键点击事件
$('body').on('contextmenu', rightClick)
// 注册内容改变事件
$('#summernote').on('summernote.change', changeContent);

// 初始化渲染模板
var h5Tpl = `
    <div class="li voiceBox"  jsonKey="{{jsonValue}}">
        <div class='voiceInfoBox'>
            <div class="demo" contenteditable="false">              
                <div class="voicebtn play"></div>
                <div class="lf">
                    <div class="title">{{title}}</div>
                    <div class="minute padtop">{{createTime}}</div>
                </div>
                <div class="lr">
                    <div class="icon">
                        <div class="wifi-symbol">
                            <div class="wifi-circle"></div>
                        </div>
                    </div>
                    <div class="time padtop">{{transSize}}</div>
                </div>
            </div>
            <div class="translate {{#if text}} translatePadding {{/if}}">
                {{#if text}}
                <p>{{text}}</p>
                {{/if}} 
            </div>
        </div>
    </div>`;
// 语音插入模板
var nodeTpl = `
        <div class='voiceInfoBox'>
            <div class="demo" contenteditable="false" >
                <div class="voicebtn play"></div>
                <div class="lf">
                    <div class="title">{{title}}</div>
                    <div class="minute padtop">{{createTime}}</div>
                </div>
                <div class="lr">
                    <div class="icon">
                        <div class="wifi-symbol">
                            <div class="wifi-circle"></div>
                        </div>
                    </div>
                    <div class="time padtop">{{transSize}}</div>
                </div>
            </div>
            <div class="translate">
                {{#if text}}
                <p>{{text}}</p>
                {{/if}}
            </div>
        </div>`;

var formatHtml = ''
var pasteData = "";
var webobj;    //js与qt通信对象
var activeVoice = null;  //当前正操作的语音对象
var activeTransVoice = null;  //执行语音转文字对象
var bTransVoiceIsReady = true;  //语音转文字是否准备好
var initFinish = false;
var voiceIntervalObj;    //语音播放动画定时器对象
var isVoicePaste = false
var isShowAir = true

// 初始化summernote
$('#summernote').summernote({
    focus: true,
    disableDragAndDrop: true,
    shortcuts: false,
    lang: 'zh-CN',
    popover: {
        air: [
            ['fontsize', ['fontsize']],
            ['forecolor', ['forecolor']],
            ['backcolor', ['backcolor']],
            ['bold', ['bold']],
            ['italic', ['italic']],
            ['underline', ['underline']],
            ['strikethrough', ['strikethrough']],
            ['ul', ['ul']],
            ['ol', ['ol']],
        ],
    },
    airMode: true,
    callbacks: {
        onPaste: function (e) {
            return;
        }
    }

});

// 监听窗口大小变化
$(window).resize(function () {
    $('.note-editable').css('min-height', $(window).height())
});

/**
 * 通知后台存储页面内容
 * @date 2021-08-19
 * @param {any} we
 * @param {any} contents
 * @param {any} $editable
 * @returns {any}
 */
function changeContent(we, contents, $editable) {
    if (webobj && initFinish) {
        webobj.jsCallTxtChange();
    }
}

// 判断编辑区是否为空
function isNoteNull() {
    return $('.note-editable').html() === '<p><br></p>'
}

//点击选中录音
$('body').on('click', '.li', function (e) {
    e.stopPropagation();
    $('.li').removeClass('active');
    setSelectRange(this)
    // console.log($(this).find('.translate')[0])
    // removeSelectRange($(this).find('.translate')[0])
    $('.note-editable').blur()
    isShowAir = false
    $(this).addClass('active');
})

$('body').on('click', '.translate', function (e) {
    // 阻止冒泡
    e.stopPropagation();
})

// 设置选区
function setSelectRange(dom) {
    var sel = window.getSelection();
    sel.removeAllRanges();
    var range = document.createRange();
    range.selectNode(dom);
    if (sel.anchorOffset == 0) {
        sel.removeAllRanges();
        sel.addRange(range);
    };
}
// 移除选区
function removeSelectRange(dom) {
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNode(dom);
    sel.removeRange(range)
}

// 取消选中样式
$('body').on('click', function () {
    $('.li').removeClass('active');
})

// 语音复制
document.addEventListener('copy', function (event) {
    isVoicePaste = false
    var selectionObj = window.getSelection();
    var rangeObj = selectionObj.getRangeAt(0);
    var docFragment = rangeObj.cloneContents();
    var testDiv = document.createElement("div");
    $(docFragment).find('.translate').removeClass('translatePadding')
    $(docFragment).find('.translate').html('')
    $(docFragment).find('.voiceBox').attr('contentEditable', false)
    // 判断是否语音复制
    if ($(docFragment).find('.voiceBox').length != 0) {
        $(docFragment).find('.voiceBox').removeClass('active')
        isVoicePaste = true
    }
    testDiv.appendChild(docFragment);

    formatHtml = testDiv.innerHTML;

    if ($(testDiv).children().length == 1 && $(testDiv).find('.voiceBox').length != 0) {
        formatHtml = '<p><br></p>' + formatHtml
    }

    pasteData = window.getSelection().toString();
    // if (formatHtml.substr(0, 11) != "<p><br></p>") {
    //     formatHtml = "";
    // }

});

// 粘贴
document.addEventListener('paste', function (event) {
    // pasteData == event.clipboardData.getData('Text')
    if (formatHtml != "" && isVoicePaste) {
        document.execCommand('insertHTML', false, formatHtml + "<p><br></p>");
        event.preventDefault()
        $('.voiceBox').removeAttr('contentEditable')
    }
    removeNullP()
});

// 判断选区是否包含语音
function isRangVoice() {
    // 获取当前选区
    var selectionObj = window.getSelection();
    var rangeObj = selectionObj.getRangeAt(0);
    var docFragment = rangeObj.cloneContents();
    // $(docFragment).find('.voiceBox')
    $(docFragment).find('.voiceBox').addClass('active')
    var testDiv = document.createElement("div");

}
// 监听键盘删除事件
$('body').on('keydown', function (e) {
    if (e.keyCode == 8) {

        var sel = window.getSelection();
        var range = sel.getRangeAt(0);
        if (range.collapsed) {
            if (range.startOffset === 0) {
                range.start = range.startContainer.previousElementSibling;
            } else {
                // range.setStartOffset(range.startOffset  - 1);
                range.startOffset = range.startOffset - 1;
            }
        }
        if ($(range.start).hasClass('voiceBox')) {
            $(range.start).attr('contentEditable', false)
        }

        if ($(range.startContainer).parents('p').prev().hasClass('voiceBox')) {
            $(range.startContainer).parents('p').prev().attr('contentEditable', false)
        }
        if ($(range.startContainer).parents('ul').prev().hasClass('voiceBox')) {
            $(range.startContainer).parents('ul').prev().attr('contentEditable', false)
        }
        if ($(range.startContainer).parents('ol').prev().hasClass('voiceBox')) {
            $(range.startContainer).parents('ol').prev().attr('contentEditable', false)
        }
        if ($(range.commonAncestorContainer).parents('.translate').html() == '<p><br></p>') {
            $(range.commonAncestorContainer).parents('.translate').removeClass('translatePadding')
            $(range.commonAncestorContainer).parents('.translate').html('')
            // let nextP = $(range.commonAncestorContainer).parents('.voiceBox').next()[0]
            // nextP.focus();
            // var newRange = document.createRange();
            // newRange.selectNode(nextP);
            // if (sel.anchorOffset == 0) {
            //     sel.removeAllRanges();
            //     sel.addRange(newRange);
            // };
            e.preventDefault();
            e.stopPropagation();
        }
        if (range.start == null
            && range.startOffset == 0
            && range.endOffset == 0
            && $(range.commonAncestorContainer).parents('.voiceBox').length != 0
            && $(range.commonAncestorContainer).parents('p').prev().length == 0) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
})

// 语音文字点击
$('body').on('mousedown', '.translate', function (e) {
    $('.voiceBox').removeAttr('contentEditable')
})

// 监听鼠标抬起事件
$('body').on('mouseup', function () {
    isRangVoice()
})

//播放
$('body').on('click', '.voicebtn', function (e) {
    // e.stopPropagation();
    var curVoice = $(this).parents('.li:first');
    var jsonString = curVoice.attr('jsonKey');
    var bIsSame = $(this).hasClass('now');
    var curBtn = $(this);
    $('.voicebtn').removeClass('now');
    activeVoice = curBtn;
    activeVoice.addClass('now');

    webobj.jsCallPlayVoice(jsonString, bIsSame, function (state) {
        //TODO 录音错误处理
    });
})

//获取整个处理后Html串,去除所有标签中临时状态
function getHtml() {
    // var rightCode = $('#summernote').summernote('code');
    // $('.li').removeClass('active');

    // if (activeVoice)
    // {
    //     activeVoice.removeClass('pause').addClass('play');
    //     activeVoice.addClass('now');
    // }

    // var handleCode = $('#summernote').summernote('code');
    // setHtml(rightCode);
    // return handleCode;

    return $('#summernote').summernote('code');
}

//获取当前所有的语音列表
function getAllNote() {
    var jsonObj = {};
    var jsonArray = [];
    var jsonString;
    $('.li').each(function () {
        jsonString = $(this).attr('jsonKey');
        jsonArray[jsonArray.length] = JSON.parse(jsonString);
    })
    jsonObj.noteDatas = jsonArray;
    var retJson = JSON.stringify(jsonObj);
    return retJson;
}

//获取当前选中录音json串
function getActiveNote() {
    var retJson = '';
    if ($('.active').length > 0) {
        retJson = $('.active').attr('jsonKey');
    }
    return retJson;
}

new QWebChannel(qt.webChannelTransport,
    function (channel) {
        webobj = channel.objects.webobj;
        //所有的c++ 调用js的接口都需要在此绑定格式，webobj.c++函数名（jscontent.cpp查看.connect(js处理函数)
        //例如 webobj.c++fun.connect(jsfun)
        webobj.callJsInitData.connect(initData);
        webobj.callJsInsertVoice.connect(insertVoiceItem);
        webobj.callJsSetPlayStatus.connect(toggleState);
        webobj.callJsSetHtml.connect(setHtml);
        webobj.callJsSetVoiceText.connect(setVoiceText);
        webobj.callJsInsertImages.connect(insertImg);
        webobj.callJsSetTheme.connect(changeColor);

        //通知QT层完成通信绑定
        webobj.jsCallChannleFinish();
    }
)

//初始化数据 
function initData(text) {
    initFinish = false;
    var arr = JSON.parse(text);
    var html = '';
    var voiceHtml;
    var txtHtml;

    arr.noteDatas.forEach((item, index) => {
        //false: txt
        if (item.type == 1) {
            if (item.text == '') {
                txtHtml = '<p><br></p>';
            }
            else {
                txtHtml = '<p>' + item.text + '</p>';
            }
            html += txtHtml;
        }
        //true: voice
        else {
            voiceHtml = transHtml(item, false);
            html += voiceHtml;
        }
    })

    $('#summernote').summernote('code', html);
    // 搜索功能
    webobj.jsCallSetDataFinsh();
    initFinish = true;
}

//录音插入数据
function insertVoiceItem(text) {
    var arr = JSON.parse(text);
    var voiceHtml = transHtml(arr, true);
    var oA = document.createElement('div');
    oA.className = 'li voiceBox';
    oA.contentEditable = false;
    oA.setAttribute('jsonKey', text);
    oA.innerHTML = voiceHtml;

    var tmpNode = document.createElement("div");
    tmpNode.appendChild(oA.cloneNode(true));
    var str = '<p><br></p>' + tmpNode.innerHTML + '<p><br></p>';

    // $('#summernote').summernote('saveRange');
    // $('#summernote').summernote('insertNode', oA);
    // $('#summernote').summernote('restoreRange');
    document.execCommand('insertHTML', false, str);

    $('.voiceBox').removeAttr('contentEditable')

    removeNullP()
}

/**
 * 移除无内容p标签
 * @date 2021-08-19
 * @returns {any}
 */
function removeNullP() {
    $('p').each((index, item) => {
        if (item.innerHTML === '') {
            $(item).remove();
        }
    })

}

/**
 * 切换播放状态
 * @date 2021-08-19
 * @param {string} state 0,播放中，1暂停中，2.结束播放
 * @returns {any}
 */
function toggleState(state) {
    if (state == '0') {
        $('.voicebtn').removeClass('pause').addClass('play');
        activeVoice.removeClass('play').addClass('pause');

        voicePlay(true);
    } else if (state == '1') {
        activeVoice.removeClass('pause').addClass('play');
        voicePlay(false);
    }
    else {
        activeVoice.removeClass('pause').addClass('play');
        activeVoice.removeClass('now');
        activeVoice = null;
        voicePlay(false);
    }

    enableSummerNote();
}

/**
 * 设置整个html内容
 * @date 2021-08-19
 * @param {string} html
 * @returns {any}
 */
function setHtml(html) {
    initFinish = false;
    $('#summernote').summernote('code', html);
    initFinish = true;
    // 搜索功能
    webobj.jsCallSetDataFinsh();
}

//设置录音转文字内容 flag: 0: 转换过程中 提示性文本（＂正在转文字中＂)１:结果 文本,空代表转失败了
function setVoiceText(text, flag) {
    if (activeTransVoice) {
        if (flag) {
            if (text) {
                activeTransVoice.find('.translate').html('<p>' + text + '</p>');
                activeTransVoice.find('.translate').addClass('translatePadding')
                webobj.jsCallTxtChange();
            }
            else {
                activeTransVoice.find('.translate').html('');
                activeTransVoice.find('.translate').removeClass('translatePadding')
            }
            //将转文字文本写到json属性里
            var jsonValue = activeTransVoice.attr('jsonKey');
            var jsonObj = JSON.parse(jsonValue);
            jsonObj.text = text;
            activeTransVoice.attr('jsonKey', JSON.stringify(jsonObj));

            webobj.jsCallTxtChange();
            activeTransVoice = null;
            bTransVoiceIsReady = true;
        }
        else {
            activeTransVoice.find('.translate').html('<div class="noselect">' + text + '</div>');
            activeTransVoice.find('.translate').addClass('translatePadding')
            bTransVoiceIsReady = false;
        }
    }
    enableSummerNote();
}

//json串拼接成对应html串 flag==》》 false: h5串  true：node串
function transHtml(json, flag) {
    let createTime = json.createTime.slice(0, 16)
    createTime = createTime.replace(/-/g, `/`)
    json.createTime = createTime
    //将json内容当其属性与标签绑定
    var strJson = JSON.stringify(json);
    json.jsonValue = strJson;
    var template;
    if (flag) {
        template = Handlebars.compile(nodeTpl);
    }
    else {
        template = Handlebars.compile(h5Tpl);
    }
    var retHtml = template(json);
    return retHtml;
}

//设置summerNote编辑状态 
function enableSummerNote() {
    if (activeVoice || (activeTransVoice && !bTransVoiceIsReady)) {
        $('#summernote').summernote('disable');
    }
    else {
        $('#summernote').summernote('enable');
    }
}

// 录音播放控制， bIsPaly=ture 表示播放。
function voicePlay(bIsPaly) {
    clearInterval(voiceIntervalObj);
    $('.wifi-circle').removeClass('first').removeClass('second').removeClass('third').removeClass('four');

    if (bIsPaly) {
        var index = 0;
        voiceIntervalObj = setInterval(function () {
            if (activeVoice && activeVoice.hasClass('pause')) {
                var voiceObj = activeVoice.parent().find('.wifi-circle');
                index++;
                switch (index) {
                    case 1:
                        voiceObj.removeClass('four').addClass('first');
                        break;
                    case 2:
                        voiceObj.removeClass('first').addClass('second');
                        break;
                    case 3:
                        voiceObj.removeClass('second').addClass('third');
                        break;
                    case 4:
                        voiceObj.removeClass('third').addClass('four');
                        index = 0;
                        break;
                }
            }
        }, 400);
    }
}

/**
 * 右键功能
 * @date 2021-08-19
 * @param {any} e
 * @returns {any} 
 * type: 0图片 1语音 2文本
 */
function rightClick(e) {
    let type = null;
    let json = null;
    let x = e.clientX
    let y = e.clientY
    if (e.target.tagName == 'IMG') {
        // 图片右键
        type = 0;
        let imgUrl = $(e.target).attr('src')
        let img = e.target
        // img.focus();
        // 设置选区
        $('.note-editable ').blur()
        setSelectRange(img)
        json = imgUrl

    } else if ($(e.target).hasClass('demo') || $(e.target).parents('.demo').length != 0) {
        // 语音右键
        type = 1;
        json = $(e.target).parents('.li:first').attr('jsonKey')

        // 选中效果
        $('.li').removeClass('active');
        $(e.target).parents('.li').addClass('active');
        // 当前没有语音在转文字时， 才可以转文字
        if (bTransVoiceIsReady) {
            activeTransVoice = $(e.target).parents('.li:first');
        }
        // $('#summernote').summernote('airPopover.rightUpdate')
        $('#summernote').summernote('airPopover.hide')
        // 设置选区
        setSelectRange($(e.target).parents('.voiceBox')[0])
    } else {
        // 文本右键
        y = $('.note-air-popover').offset().top - $(document).scrollTop() + 50
        json = ''
        type = 2;

    }
    webobj.jsCallPopupMenu(type, x, y, json);
    // 阻止默认右键事件
    // e.preventDefault()
}

/**
 * 深色浅色变换
 * @date 2021-08-19
 * @param {any} flag 1浅色 2深色
 * @returns {any}
 */
function changeColor(flag) {
    if (flag == 1) {
        $('body').css({
            'background': 'rgba(255,255,255,1)',
            "color": 'rgba(65,77,104,1)'
        })
        $('.title').css({
            "color": 'rgba(0,26,46,1)'
        })
        $('.time').css({
            "color": 'rgba(65,77,104,1)'
        })
        $('.li').css({
            "background": 'rgba(0,0,0,0.05)'
        })
        $('.minute').css({
            "color": 'rgba(138,161,180,1)'
        })
        $('.note-popover .popover-content').css({
            "background": 'rgba(247,247,247,1)'
        })
        $('.note-current-fontsize').css({
            "color": 'rgba(65,77,104,1)'
        })
        $('.note-icon-caret').css({
            "color": 'rgba(65,77,104,1)'
        })
        $('.dropdown-menu').css({
            "background": 'rgba(247,247,247,1)'
        })
        $('.colorFont').css({
            "color": 'rgba(65,77,104,1)'
        })
        changeIconColor('lightColor');
    } else {
        $('body').css({
            'background': 'rgba(40,40,40,1)',
            "color": 'rgba(192,198,212,1)'
        })
        $('.title , .time').css({
            "color": 'rgba(192,198,212,1)'
        })
        $('.li').css({
            "background": 'rgba(255,255,255,0.05)'
        })
        $('.minute').css({
            "color": 'rgba(109,124,136,1)'
        })
        $('.note-popover .popover-content').css({
            "background": 'rgba(42,42,42,1)'
        })
        $('.note-current-fontsize').css({
            "color": 'rgba(197,207,224,1)'
        })
        $('.note-icon-caret').css({
            "color": 'rgba(197,207,224,1)'
        })
        $('.note-popover .popover-content i').css({
            "color": '#C5CFE0'
        })
        $('.dropdown-menu').css({
            "background": 'rgba(42,42,42,1)'
        })
        $('.colorFont').css({
            "color": 'rgba(192,198,212,1)'
        })
        $('.dropdown-fontsize li a').css({
            "color": 'rgba(192,198,212,1)'
        })
        changeIconColor('darkColor');
    }

}

/**
 * 改变icon图标颜色
 * @date 2021-08-19
 * @param {any} color
 * @returns {any}
 */
function changeIconColor(color) {
    let newColor = color == "lightColor" ? 'lightColor' : "darkColor"
    let oldColor = color == "lightColor" ? 'darkColor' : "lightColor"
    let iconList = ['icon-down', 'icon-strikethrough', 'icon-bold', 'icon-italic', 'icon-underline', 'icon-forecolor', 'icon-backcolor', 'icon-ul', 'icon-ol']
    iconList.forEach((item, index) => {
        if (item == 'icon-forecolor') {
            $('.' + item + ' .path3').removeClass(oldColor)
            $('.' + item + ' .path3').addClass(newColor)
        } else if (item == 'icon-backcolor') {
            $('.' + item + ' .path1,.path2,.path3,.path4').removeClass(oldColor)
            $('.' + item + ' .path1,.path2,.path3,.path4').addClass(newColor)
        }
        else {
            $('.' + item).removeClass(oldColor)
            $('.' + item).addClass(newColor)
        }
    })
}

/**
 * 插入图片
 * @date 2021-08-19
 * @param {any} urlStr 图片地址list
 * @returns {any}
 */
function insertImg(urlStr) {
    urlStr.forEach((item, index) => {
        $("#summernote").summernote('insertImage', item, 'img');
    })
}

// 禁用ctrl+v
document.onkeydown = function (event) {
    if (event.ctrlKey && window.event.keyCode == 86) {
        webobj.jsCallPaste()
        return false;
    }

}
// ctrl+z 移除可编辑
document.onkeyup = function (event) {
    if (event.ctrlKey && window.event.keyCode == 90) {
        $('.voiceBox').removeAttr('contentEditable')
    }
}

// ctrl+b 
document.onkeyup = function (event) {
    if (event.ctrlKey && window.event.keyCode == 66) {
        console.log("ctrl+b")
    }
}

