module.exports = forceUTF8

require('string.prototype.at')
require('string.prototype.codepointat')
require('string.fromcodepoint')

function test(){
    var err=0
    var char='';
    var debug=0;
    for(var i=128169;i<=128169;i++){ //test characters
        char=String.fromCodePoint(i) //char
        var mcode = Buffer.from(char).toString('binary') //miscoded char
        var rcode=forceUTF8( mcode ) //recoded char
        
        if(rcode!==char || debug===1){
            console.log("char    :"+char)
            console.log("nr      :"+i)
            console.log("mcode   :"+mcode)
            console.log("rcode   :"+rcode)
            console.log("char    :"+createBinaryString(char.codePointAt(0)))
            for(var k=0;k<mcode.length;k++){
                console.log("mcode"+k+"  :"+createBinaryString(mcode.codePointAt(k)))
                }
            console.log("rcode   :"+createBinaryString(rcode.codePointAt(0)))
            if(debug===0){
                err=1
                return
            }
        }
    }
    if(err){
        return
    }
}

function forceUTF8(text){
    var max= text.length;
    var buf=''
    var changed=false
    var debug = 0
    if(debug){
        console.log("chr1   :"+createBinaryString(text.codePointAt(0)))
        console.log("chr2   :"+createBinaryString(text.codePointAt(1)))
        console.log("chr3   :"+createBinaryString(text.codePointAt(2)))
        console.log("chr4   :"+createBinaryString(text.codePointAt(3)))
        
        
        var char1 = ((parseInt('00111111',2) & text.codePointAt(0) ) << 6)
        console.log("code1  :"+createBinaryString(char1))
        var char2 = (parseInt('00111111',2) & text.codePointAt(1) ) 
        console.log("code2  :"+createBinaryString(char2))
        var char3 = (parseInt('00111111',2) & text.codePointAt(2) ) 
        console.log("code3  :"+createBinaryString(char3))
        var char4 = (parseInt('00111111',2) & text.codePointAt(3) ) 
        console.log("code3  :"+createBinaryString(char4))
    }


    for(var i=0;i<max;i++){
            var c1=text.at(i);
            var c2=text.at(i+1);
            var c3=text.at(i+2);
            var c4=text.at(i+3);
            if(c1.codePointAt(0)>=parseInt('11000000',2) && c1.codePointAt(0)<=parseInt('11011111',2) && //char 1
                c2.codePointAt(0)>=parseInt('10000000',2) && c2.codePointAt(0)<=parseInt('10111111',2) //char 2
                ){ // probably error code in 2 bytes
                buf+=String.fromCodePoint(
                    ((parseInt('00111111',2) & c1.codePointAt(0) ) << 6) + 
                    (parseInt('00111111',2) & c2.codePointAt(0) ) 
                    )
                i=i+1;//merge character
                if(debug){
                    console.log("test1  :"+createBinaryString(((parseInt('00111111',2) & c1.codePointAt(0) ) << 6) ))
                    console.log("test2  :"+createBinaryString((parseInt('00111111',2) & c2.codePointAt(0) ) ))
                }
                changed=true
            }else if(c1.codePointAt(0)>=parseInt('11100000',2) && c1.codePointAt(0)<=parseInt('11101111',2) && //char 1
                    c2.codePointAt(0)>=parseInt('10000000',2) && c2.codePointAt(0)<=parseInt('10111111',2) && //char 2
                    c3.codePointAt(0)>=parseInt('10000000',2) && c3.codePointAt(0)<=parseInt('10111111',2)){ //char 3
                buf+=String.fromCodePoint(
                    ((parseInt('00011111',2) & c1.codePointAt(0) ) << 12) + //char1
                    ((parseInt('00111111',2) & c2.codePointAt(0) ) << 6) + //char2
                    (parseInt('00111111',2) & c3.codePointAt(0) ) //char 3
                    )// error code in 3 bytes
                i=i+2;//merge character
                if(debug){
                    console.log("test1  :"+createBinaryString(((parseInt('00011111',2) & c1.codePointAt(0) ) << 12)))
                    console.log("test2  :"+createBinaryString(((parseInt('00111111',2) & c2.codePointAt(0) ) << 6)))
                    console.log("test3  :"+createBinaryString((parseInt('00111111',2) & c3.codePointAt(0) )))
                }
                changed=true
            }else if(c1.codePointAt(0)>=parseInt('11110000',2) && c1.codePointAt(0)<=parseInt('11110111',2) && //char 1
                    c2.codePointAt(0)>=parseInt('10000000',2) && c2.codePointAt(0)<=parseInt('10111111',2) && //char 2
                    c3.codePointAt(0)>=parseInt('10000000',2) && c3.codePointAt(0)<=parseInt('10111111',2) && //char 3
                    c4.codePointAt(0)>=parseInt('10000000',2) && c4.codePointAt(0)<=parseInt('10111111',2)){ //char 4
                buf+=String.fromCodePoint(
                    ((parseInt('00001111',2) & c1.codePointAt(0) ) << 18) + //char1
                    ((parseInt('00111111',2) & c2.codePointAt(0) ) << 12) + //char2
                    ((parseInt('00111111',2) & c3.codePointAt(0) ) << 6) + //char3
                    (parseInt('00111111',2) & c4.codePointAt(0) ) //char 4
                    )// error code in 4 bytes
                i=i+3;//merge character
                if(debug){
                    console.log("test1  :"+createBinaryString(((parseInt('00011111',2) & c1.codePointAt(0) ) << 18)))
                    console.log("test2  :"+createBinaryString(((parseInt('00111111',2) & c2.codePointAt(0) ) << 12)))
                    console.log("test3  :"+createBinaryString(((parseInt('00111111',2) & c3.codePointAt(0) ) << 6)))
                    console.log("test4  :"+createBinaryString((parseInt('00111111',2) & c4.codePointAt(0) )))
                }
                changed=true
            }else if(c1.codePointAt(0)>=parseInt('11000000',2) && c1.codePointAt(0)<=parseInt('11011111',2) && //char 1
                c2.codePointAt(0)>=parseInt('110000000',2) && c2.codePointAt(0)<=parseInt('110111111',2) //char 2 9 bits?
                ){ // probably error code char 2 with 9 bits
                buf+=c1
                i=i+1;//merge character
                if(debug){
                    console.log("test1  :"+createBinaryString(((parseInt('00111111',2) & c1.codePointAt(0) ) << 6) ))
                    console.log("test2  :"+createBinaryString((parseInt('00111111',2) & c2.codePointAt(0) ) ))
                }
                changed=true
            }else{ // no miscode
                if(c1.codePointAt(0)>=parseInt('1111111111111111',2) && //char 1
                    c2.codePointAt(0)>=parseInt('11111111',2)  //char 2
                    ){ // 32 bit unicode
                        buf+=c1
                        i=i+1
                    }else{ //16 bit unicode
                        buf+=c1
                    }
                }
            }

    if(changed){
        buf=forceUTF8(buf) //recode again to fix multiple miscodings
    }
    return buf
}



function createBinaryString (nMask) {
  // nMask must be between -2147483648 and 2147483647
  for (var nFlag = 0, nShifted = nMask, sMask = ""; nFlag < 32;
       nFlag++, sMask += String(nShifted >>> 31), nShifted <<= 1);
  return sMask;
}