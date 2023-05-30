function getPassword(){
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*?/>.<+-";

    var passwordLength=8;
    var password=" ";

    for(var i=0;i<passwordLength;i++)
    {
        var randomNumber = Math.random()*chars.length;
        password+=chars.substring(randomNumber,randomNumber+1);
    }

    document.getElementById("password").value=password;

}
const btn = document.querySelector('.btn');
btn.addEventListener('click', getPassword);